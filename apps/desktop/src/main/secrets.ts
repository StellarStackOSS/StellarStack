import { randomBytes, randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { app } from "electron"

// Per-install secrets persisted in a single JSON file under the
// platform's userData directory. Not encrypted — these only protect the
// API ↔ daemon HMAC channel inside this single machine; on a multi-user
// box the user can `chmod 600` the file if they care.

type Secrets = {
  /** 32-byte hex HMAC the API and daemon both sign callbacks with. */
  daemonHmacKey: string
  /** UUID for the local node row. The daemon refuses to start without
   *  one; we mint it client-side so the API and daemon agree from the
   *  first launch. */
  daemonNodeId: string
  /** Better-auth's session signing secret. Regenerating it would
   *  invalidate every signed-in session, so we persist it across
   *  launches and only rotate it when the secrets file is wiped. */
  authSecret: string
  /** True once the user has completed the onboarding form. The API's
   *  /setup response is the source of truth; this is just a hint. */
  setupCompleted: boolean
}

const DEFAULT: Secrets = {
  daemonHmacKey: "",
  daemonNodeId: "",
  authSecret: "",
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

/**
 * Returns the local node UUID, minting + persisting one on first call.
 */
export const getOrCreateDaemonNodeId = (): string => {
  const secrets = read()
  if (secrets.daemonNodeId !== "") return secrets.daemonNodeId
  const id = randomUUID()
  write({ ...secrets, daemonNodeId: id })
  return id
}

/**
 * Returns the better-auth session signing secret, generating + persisting
 * one on first call. Persisting matters because rotating it would
 * invalidate every signed-in session (i.e. the user would be logged out
 * every time they relaunch the app).
 */
export const getOrCreateAuthSecret = (): string => {
  const secrets = read()
  if (secrets.authSecret !== "") return secrets.authSecret
  const value = randomBytes(32).toString("hex")
  write({ ...secrets, authSecret: value })
  return value
}

export const isSetupCompleted = (): boolean => read().setupCompleted

export const markSetupCompleted = (): void => {
  write({ ...read(), setupCompleted: true })
}
