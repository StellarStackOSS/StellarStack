/**
 * Single audit log entry as returned by `GET /admin/audit`.
 */
export type AuditEntry = {
  id: string
  actorId: string | null
  ip: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, string | number | boolean> | null
  createdAt: string
}

export type AuditListResponse = {
  entries: AuditEntry[]
  offset: number
  limit: number
}
