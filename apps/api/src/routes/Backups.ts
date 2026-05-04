import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { backupsTable } from "@workspace/db/schema/backups"
import { nodesTable } from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { callDaemon } from "@/lib/DaemonHttp"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const createBackupSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/),
})

export const buildBackupsRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const rows = await db
        .select()
        .from(backupsTable)
        .where(eq(backupsTable.serverId, serverId))
      return c.json({ backups: rows })
    })
    .post("/:serverId", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const parsed = createBackupSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const { node, server } = await loadServerNode(db, serverId)
      if (node.daemonPublicKey === null) {
        throw new ApiException("nodes.unreachable", { status: 503 })
      }
      const [row] = await db
        .insert(backupsTable)
        .values({
          serverId,
          name: parsed.data.name,
          storage: "local",
          state: "pending",
        })
        .returning()
      if (row === undefined) throw new ApiException("internal.unexpected", { status: 500 })

      const baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonPort}`
      const resp = await callDaemon({
        baseUrl,
        nodeId: node.id,
        signingKeyHex: node.daemonPublicKey,
        method: "POST",
        path: `/api/servers/${server.id}/backups?op=create`,
        body: { name: parsed.data.name },
      })
      if (!resp.ok) {
        await db
          .update(backupsTable)
          .set({ state: "failed", failureCode: "backups.create_failed" })
          .where(eq(backupsTable.id, row.id))
        throw new ApiException("internal.unexpected", { status: 502 })
      }
      const result = (await resp.json()) as {
        name: string
        bytes: number
        sha256: string
      }
      const [updated] = await db
        .update(backupsTable)
        .set({
          state: "ready",
          bytes: result.bytes,
          sha256: result.sha256,
          completedAt: new Date(),
        })
        .where(eq(backupsTable.id, row.id))
        .returning()
      return c.json({ backup: updated })
    })
    .post("/:serverId/:backupId/restore", async (c) => {
      const serverId = c.req.param("serverId")
      const backupId = c.req.param("backupId")
      await assertAccess(db, c.get("user"), serverId)
      const backup = (
        await db
          .select()
          .from(backupsTable)
          .where(
            and(
              eq(backupsTable.id, backupId),
              eq(backupsTable.serverId, serverId)
            )
          )
          .limit(1)
      )[0]
      if (backup === undefined) {
        throw new ApiException("internal.unexpected", { status: 404 })
      }
      const { node, server } = await loadServerNode(db, serverId)
      if (node.daemonPublicKey === null) {
        throw new ApiException("nodes.unreachable", { status: 503 })
      }
      const baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonPort}`
      const resp = await callDaemon({
        baseUrl,
        nodeId: node.id,
        signingKeyHex: node.daemonPublicKey,
        method: "POST",
        path: `/api/servers/${server.id}/backups?op=restore`,
        body: { name: backup.name },
      })
      if (!resp.ok) {
        throw new ApiException("internal.unexpected", { status: 502 })
      }
      return c.json({ ok: true })
    })
    .delete("/:serverId/:backupId", async (c) => {
      const serverId = c.req.param("serverId")
      const backupId = c.req.param("backupId")
      await assertAccess(db, c.get("user"), serverId)
      const backup = (
        await db
          .select()
          .from(backupsTable)
          .where(
            and(
              eq(backupsTable.id, backupId),
              eq(backupsTable.serverId, serverId)
            )
          )
          .limit(1)
      )[0]
      if (backup === undefined) {
        throw new ApiException("internal.unexpected", { status: 404 })
      }
      const { node, server } = await loadServerNode(db, serverId)
      if (node.daemonPublicKey !== null) {
        const baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonPort}`
        await callDaemon({
          baseUrl,
          nodeId: node.id,
          signingKeyHex: node.daemonPublicKey,
          method: "POST",
          path: `/api/servers/${server.id}/backups?op=delete`,
          body: { name: backup.name },
        }).catch(() => {
          // Daemon-side delete is idempotent; if it fails we still
          // remove the DB row so the UI doesn't show a phantom backup.
        })
      }
      await db.delete(backupsTable).where(eq(backupsTable.id, backupId))
      return c.json({ ok: true })
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

const loadServerNode = async (db: Db, serverId: string) => {
  const row = (
    await db
      .select({ server: serversTable, node: nodesTable })
      .from(serversTable)
      .innerJoin(nodesTable, eq(nodesTable.id, serversTable.nodeId))
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (row === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  return row
}
