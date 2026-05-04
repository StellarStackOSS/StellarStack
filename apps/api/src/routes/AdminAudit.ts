import { and, desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SQL } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { auditLogTable } from "@workspace/db/schema/audit"

import type { Auth } from "@/auth"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"
import type { AuthVariables } from "@/middleware/RequireSession"

export const buildAdminAuditRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const adminMiddleware = buildRequireAdmin(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", ...adminMiddleware)
    .get("/", async (c) => {
      const limit = Math.min(
        200,
        Math.max(1, Number(c.req.query("limit") ?? 50))
      )
      const offset = Math.max(0, Number(c.req.query("offset") ?? 0))
      const filters: SQL[] = []
      const actorId = c.req.query("actorId")
      const action = c.req.query("action")
      const targetType = c.req.query("targetType")
      const targetId = c.req.query("targetId")
      if (actorId) filters.push(eq(auditLogTable.actorId, actorId))
      if (action) filters.push(eq(auditLogTable.action, action))
      if (targetType) filters.push(eq(auditLogTable.targetType, targetType))
      if (targetId) filters.push(eq(auditLogTable.targetId, targetId))
      const where = filters.length > 0 ? and(...filters) : undefined
      const rows = await (where !== undefined
        ? db
            .select()
            .from(auditLogTable)
            .where(where)
            .orderBy(desc(auditLogTable.createdAt))
            .limit(limit)
            .offset(offset)
        : db
            .select()
            .from(auditLogTable)
            .orderBy(desc(auditLogTable.createdAt))
            .limit(limit)
            .offset(offset))
      return c.json({ entries: rows, offset, limit })
    })
}
