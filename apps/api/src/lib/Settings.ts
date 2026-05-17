import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { appSettingsTable } from "@workspace/db/schema/settings"

/**
 * Free-form app-wide settings keyed by string. Values can be plain or
 * AES-256-GCM encrypted; the helper here transparently handles both.
 *
 * Encryption key = SHA-256(BETTER_AUTH_SECRET). We piggyback on the
 * existing per-install secret rather than minting another long-lived
 * key the operator has to manage. Rotating BETTER_AUTH_SECRET will
 * break decryption of stored values — operator must re-enter API keys
 * after rotation. Acceptable for the kind of settings this stores
 * (third-party API tokens that can always be re-issued).
 */
const KEY_LEN = 32
const IV_LEN = 12
const TAG_LEN = 16

const deriveKey = (secret: string): Buffer =>
  createHash("sha256").update(secret).digest().subarray(0, KEY_LEN)

export const encryptSetting = (plaintext: string, secret: string): string => {
  const key = deriveKey(secret)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString("base64")
}

export const decryptSetting = (payload: string, secret: string): string => {
  const buf = Buffer.from(payload, "base64")
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("encrypted setting payload too short")
  }
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = buf.subarray(IV_LEN + TAG_LEN)
  const key = deriveKey(secret)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
}

export class SettingsStore {
  constructor(private readonly db: Db, private readonly secret: string) {}

  async get(key: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, key))
      .limit(1)
    if (row === undefined) return null
    return row.encrypted ? decryptSetting(row.value, this.secret) : row.value
  }

  async set(
    key: string,
    value: string,
    options: { encrypted?: boolean; userId?: string | null } = {}
  ): Promise<void> {
    const encrypted = options.encrypted ?? false
    const stored = encrypted ? encryptSetting(value, this.secret) : value
    await this.db
      .insert(appSettingsTable)
      .values({
        key,
        value: stored,
        encrypted,
        updatedBy: options.userId ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: {
          value: stored,
          encrypted,
          updatedBy: options.userId ?? null,
          updatedAt: new Date(),
        },
      })
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(appSettingsTable).where(eq(appSettingsTable.key, key))
  }
}
