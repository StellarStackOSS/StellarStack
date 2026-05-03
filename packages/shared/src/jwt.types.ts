/**
 * Permission scopes a daemon-bound JWT may carry. Each scope corresponds to a
 * narrowly-defined operation the daemon can perform on behalf of the user.
 */
export type DaemonJwtScope =
  | "console.read"
  | "console.write"
  | "stats.read"
  | "control.start"
  | "control.stop"
  | "control.restart"
  | "files.read"
  | "files.write"
  | "files.delete"
  | "sftp"
  | "backup.read"
  | "backup.write"
  | "transfer.source"
  | "transfer.target"

/**
 * Claims carried by every JWT minted by the API for direct daemon access.
 * Daemons validate against the per-node signing key established at pairing
 * and reject any frame whose required scope is not in `scope`.
 */
export type DaemonJwtClaims = {
  /** Subject — the StellarStack user id. */
  sub: string
  /** Server id this token authorises. */
  server: string
  /** Node id; daemon rejects tokens minted for other nodes. */
  node: string
  /** Permission scopes granted by this token. */
  scope: DaemonJwtScope[]
  /** Issued-at, seconds since epoch. */
  iat: number
  /** Expiry, seconds since epoch. */
  exp: number
  /** Token id — single-use guard for SFTP password tokens. */
  jti: string
}

/**
 * Claims carried by a node-pairing token. Single-use; consumed by
 * `stellar-daemon configure`.
 */
export type PairingTokenClaims = {
  /** Node id this token claims. */
  node: string
  /** Issued-at, seconds since epoch. */
  iat: number
  /** Expiry, seconds since epoch. */
  exp: number
  /** Token id — must match the row in `node_pairing_tokens`. */
  jti: string
}

/**
 * Claims carried by a one-time transfer token. Authenticates source and
 * target daemon to each other for a single transfer session.
 */
export type TransferTokenClaims = {
  sourceServer: string
  targetServer: string
  sourceNode: string
  targetNode: string
  iat: number
  exp: number
  jti: string
}
