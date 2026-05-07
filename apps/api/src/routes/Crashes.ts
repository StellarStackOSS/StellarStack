import { and, count, desc, eq } from "drizzle-orm"
import { Hono } from "hono"

import type { Db } from "@workspace/db/client.types"
import {
  serverCrashesTable,
  type ServerCrashRow,
} from "@workspace/db/schema/crashes"
import { serversTable } from "@workspace/db/schema/servers"
import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

export const buildCrashesRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/crashes", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const limit = Math.min(
        100,
        Math.max(1, Number(c.req.query("limit") ?? 25))
      )
      const offset = Math.max(0, Number(c.req.query("offset") ?? 0))
      const filter = eq(serverCrashesTable.serverId, serverId)
      const [entries, totalRow] = await Promise.all([
        db
          .select()
          .from(serverCrashesTable)
          .where(filter)
          .orderBy(desc(serverCrashesTable.occurredAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ n: count() })
          .from(serverCrashesTable)
          .where(filter)
          .then((rows) => rows[0]),
      ])
      return c.json({
        entries: entries.map((e: ServerCrashRow) => ({
          id: e.id,
          serverId: e.serverId,
          exitCode: e.exitCode,
          signal: e.signal,
          oomKilled: e.oomKilled === 1,
          logTail: e.logTail,
          occurredAt: e.occurredAt.toISOString(),
        })),
        offset,
        limit,
        total: Number(totalRow?.n ?? 0),
      })
    })
    .get("/:serverId/crashes/:crashId", async (c) => {
      const serverId = c.req.param("serverId")
      const crashId = c.req.param("crashId")
      await assertAccess(db, c.get("user"), serverId)
      const row = (
        await db
          .select()
          .from(serverCrashesTable)
          .where(
            and(
              eq(serverCrashesTable.id, crashId),
              eq(serverCrashesTable.serverId, serverId)
            )
          )
          .limit(1)
      )[0]
      if (row === undefined) {
        throw new ApiException("crashes.not_found", { status: 404 })
      }
      return c.json({
        id: row.id,
        serverId: row.serverId,
        exitCode: row.exitCode,
        signal: row.signal,
        oomKilled: row.oomKilled === 1,
        logTail: row.logTail,
        occurredAt: row.occurredAt.toISOString(),
      })
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
