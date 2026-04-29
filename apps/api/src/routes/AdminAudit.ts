import { Hono } from "hono"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { auditLogTable } from "@workspace/db/schema/audit"
import { apiValidationError } from "@workspace/shared/errors"

import type { AuthVariables } from "@/middleware/RequireSession"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  actorId: z.string().uuid().optional(),
  action: z.string().min(1).optional(),
  targetType: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

/**
 * Admin-only audit log reader. Returns a paginated slice of the `audit_log`
 * table with optional filters by actor, action, and time range.
 */
export const buildAdminAuditRoute = (params: { db: Db }) => {
  const { db } = params

  return new Hono<{ Variables: AuthVariables }>().get("/", async (c) => {
    const parsed = querySchema.safeParse(c.req.query())
    if (!parsed.success) {
      throw apiValidationError(parsed.error)
    }
    const q = parsed.data

    const conditions = []
    if (q.actorId !== undefined) {
      conditions.push(eq(auditLogTable.actorId, q.actorId))
    }
    if (q.action !== undefined) {
      conditions.push(eq(auditLogTable.action, q.action))
    }
    if (q.targetType !== undefined) {
      conditions.push(eq(auditLogTable.targetType, q.targetType))
    }
    if (q.targetId !== undefined) {
      conditions.push(eq(auditLogTable.targetId, q.targetId))
    }
    if (q.from !== undefined) {
      conditions.push(gte(auditLogTable.createdAt, new Date(q.from)))
    }
    if (q.to !== undefined) {
      conditions.push(lte(auditLogTable.createdAt, new Date(q.to)))
    }

    const rows = await db
      .select()
      .from(auditLogTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(q.limit)
      .offset(q.offset)

    return c.json({ entries: rows, offset: q.offset, limit: q.limit })
  })
}
