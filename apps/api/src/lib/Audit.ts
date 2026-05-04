import type { Db } from "@workspace/db/client.types"
import { auditLogTable } from "@workspace/db/schema/audit"

/**
 * Append an audit-log entry. `action` is a translation key
 * (`servers.action.*`, `admin.users.*`, etc.). Best-effort: failures are
 * logged but never propagate; an audit-write outage shouldn't take down
 * the original action.
 */
export const writeAudit = async (params: {
  db: Db
  actorId: string | null
  ip?: string | null
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, string | number | boolean>
}): Promise<void> => {
  try {
    await params.db.insert(auditLogTable).values({
      actorId: params.actorId,
      ip: params.ip ?? null,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata ?? null,
    })
  } catch (err) {
    console.error("audit write failed:", err)
  }
}
