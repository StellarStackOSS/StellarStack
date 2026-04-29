/**
 * Single node row as returned by `GET /admin/nodes`. Mirrors the Drizzle
 * select shape; timestamps are ISO strings on the wire.
 */
export type NodeListRow = {
  id: string
  name: string
  fqdn: string
  scheme: "http" | "https"
  daemonPort: number
  sftpPort: number
  daemonPublicKey: string | null
  memoryTotalMb: number
  diskTotalMb: number
  connectedAt: string | null
  createdAt: string
}

/**
 * Body of `POST /admin/nodes`.
 */
export type CreateNodeRequest = {
  name: string
  fqdn: string
  scheme: "http" | "https"
  daemonPort: number
  sftpPort: number
  memoryTotalMb: number
  diskTotalMb: number
}

/**
 * Response of `POST /admin/nodes/:id/pairing-tokens`.
 */
export type PairingTokenResponse = {
  token: string
  expiresAt: string
}
