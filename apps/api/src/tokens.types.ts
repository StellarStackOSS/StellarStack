/**
 * Result returned by `mintPairingToken`. The plaintext JWT must be shown to
 * the admin once and never persisted. The `tokenHash` is what we store in
 * `node_pairing_tokens` so the unhashed value can never be recovered from
 * the database.
 */
export type PairingTokenMintResult = {
  token: string
  tokenHash: string
  jti: string
  expiresAt: Date
}
