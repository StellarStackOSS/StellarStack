import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { app } from "electron"

// Per-install secrets persisted in a single JSON file under the
// platform's userData directory. Not encrypted — these only protect the
// API ↔ daemon HMAC channel inside this single machine; on a multi-user
// box the user can `chmod 600` the file if they care.

type Secrets = {
  daemonHmacKey: string
  setupCompleted: boolean
}

const DEFAULT: Secrets = {
  daemonHmacKey: "",
  setupCompleted: false,
}

let cached: Secrets | null = null

const filePath = (): string =>
  path.join(app.getPath("userData"), "stellar-secrets.json")

const read = (): Secrets => {
  if (cached !== null) return cached
  try {
    const raw = fs.readFileSync(filePath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<Secrets>
    cached = { ...DEFAULT, ...parsed }
  } catch {
    cached = { ...DEFAULT }
  }
  return cached
}

const write = (next: Secrets): void => {
  cached = next
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(next, null, 2))
}

/**
 * Returns the daemon HMAC key, generating + persisting one on first call.
 * The same value is then handed to both the API (as an env var) and the
 * daemon (via its config file) so they agree on signing.
 */
export const getOrCreateDaemonKey = (): string => {
  const secrets = read()
  if (secrets.daemonHmacKey !== "") return secrets.daemonHmacKey
  const key = randomBytes(32).toString("hex")
  write({ ...secrets, daemonHmacKey: key })
  return key
}

export const isSetupCompleted = (): boolean => read().setupCompleted

export const markSetupCompleted = (): void => {
  write({ ...read(), setupCompleted: true })
}
