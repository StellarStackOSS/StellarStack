/**
 * Backup row returned by `GET /servers/:id/backups`.
 */
export type BackupRow = {
  id: string
  serverId: string
  name: string
  sha256: string | null
  bytes: number
  storage: "local" | "s3"
  state: "pending" | "ready" | "failed"
  failureCode: string | null
  s3ObjectKey: string | null
  locked: boolean
  completedAt: string | null
  createdAt: string
}

/**
 * Per-server S3 destination as returned by `GET /servers/:id/destination`
 * (secret access key is never re-served).
 */
export type BackupDestination = {
  id: string
  serverId: string
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKeyId: string
  forcePathStyle: boolean
  createdAt: string
  updatedAt: string
}

export type UpsertDestinationRequest = {
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}
