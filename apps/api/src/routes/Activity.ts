import { and, desc, eq } from "drizzle-orm"
import { Hono } from "hono"

import type { Db } from "@workspace/db/client.types"
import { auditLogTable } from "@workspace/db/schema/audit"
import { serversTable } from "@workspace/db/schema/servers"
import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

/**
 * Per-server activity log. Read-only for the owner / admin. Writes
 * happen elsewhere — every server action that needs an audit trail
 * inserts into `audit_log` with `targetType="server"` + `targetId=<uuid>`.
 */
export const buildActivityRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/activity", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const limit = Math.min(
        100,
        Math.max(1, Number(c.req.query("limit") ?? 25))
      )
      const offset = Math.max(0, Number(c.req.query("offset") ?? 0))
      const entries = await db
        .select()
        .from(auditLogTable)
        .where(
          and(
            eq(auditLogTable.targetType, "server"),
            eq(auditLogTable.targetId, serverId)
          )
        )
        .orderBy(desc(auditLogTable.createdAt))
        .limit(limit)
        .offset(offset)
      return c.json({ entries, offset, limit })
    })
}

const assertAccess = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<void> => {
  const server = (
    await db
      .select({ ownerId: serversTable.ownerId })
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (server === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  if (user.isAdmin === true) return
  if (server.ownerId === user.id) return
  throw new ApiException("permissions.denied", { status: 403 })
}
