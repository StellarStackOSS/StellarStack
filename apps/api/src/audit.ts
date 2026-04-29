import type { Context } from "hono"

import type { Db } from "@workspace/db/client.types"
import { auditLogTable } from "@workspace/db/schema/audit"

type WriteAuditParams = {
  db: Db
  actorId: string | null
  ip: string | null
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, string | number | boolean>
}

/**
 * Append one row to the audit log. Fire-and-forget — errors are swallowed
 * so a logging failure never bubbles up to the client.
 */
export const writeAudit = (params: WriteAuditParams): void => {
  params.db
    .insert(auditLogTable)
    .values({
      actorId: params.actorId ?? undefined,
      ip: params.ip,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
    })
    .catch(() => {})
}

/**
 * Extract the best-effort client IP from a Hono context. Respects
 * `X-Forwarded-For` and `CF-Connecting-IP` for deployments behind a proxy.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clientIp = (c: Context<any>): string | null => {
  return (
    (c.req.header("cf-connecting-ip") as string | undefined) ??
    (c.req.header("x-forwarded-for") as string | undefined)
      ?.split(",")[0]
      ?.trim() ??
    null
  )
}
