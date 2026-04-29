/**
 * Wire shape returned by `GET /servers/:id/files`. Mirrors
 * apps/daemon/internal/files.Entry.
 */
export type FileEntry = {
  name: string
  path: string
  isDir: boolean
  size: number
  mode: string
  modTime: string
}

/**
 * Result of `POST /servers/:id/files-credentials`.
 */
export type FileCredentials = {
  token: string
  expiresAt: string
  baseUrl: string
}

/**
 * Result of `POST /servers/:id/sftp-credentials`.
 */
export type SftpCredentials = {
  host: string
  port: number
  username: string
  password: string
  expiresAt: string
}
