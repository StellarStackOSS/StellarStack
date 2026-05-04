import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  backupDestinationsTable,
  backupsTable,
} from "@workspace/db/schema/backups"
import { nodesTable } from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { runBackup } from "@/lib/BackupRunner"
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
  /** Optional S3 destination id; ignored in v1 (local-only backups). */
  destinationId: z.string().uuid().optional(),
})

export const buildBackupsRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/backups", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const rows = await db
        .select()
        .from(backupsTable)
        .where(eq(backupsTable.serverId, serverId))
      return c.json({ backups: rows })
    })
    .post("/:serverId/backups", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const parsed = createBackupSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const id = await runBackup({ db, serverId, name: parsed.data.name })
      if (id === null) {
        throw new ApiException("internal.unexpected", { status: 502 })
      }
      const [row] = await db
        .select()
        .from(backupsTable)
        .where(eq(backupsTable.id, id))
        .limit(1)
      return c.json({ backup: row })
    })
    .post("/:serverId/backups/:backupId/restore", async (c) => {
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
    .get("/:serverId/destination", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const dest = (
        await db
          .select({
            id: backupDestinationsTable.id,
            endpoint: backupDestinationsTable.endpoint,
            region: backupDestinationsTable.region,
            bucket: backupDestinationsTable.bucket,
            prefix: backupDestinationsTable.prefix,
            accessKeyId: backupDestinationsTable.accessKeyId,
            forcePathStyle: backupDestinationsTable.forcePathStyle,
            createdAt: backupDestinationsTable.createdAt,
            updatedAt: backupDestinationsTable.updatedAt,
          })
          .from(backupDestinationsTable)
          .where(eq(backupDestinationsTable.serverId, serverId))
          .limit(1)
      )[0]
      return c.json({ destination: dest ?? null })
    })
    .put("/:serverId/destination", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      // Partial-update support: secretAccessKey is optional on update so
      // operators can rotate the public credential without retyping the
      // secret. The first PUT must include it; subsequent PUTs without
      // it preserve the stored value.
      const schema = z.object({
        endpoint: z.string().url(),
        region: z.string().min(1),
        bucket: z.string().min(1),
        prefix: z.string().default(""),
        accessKeyId: z.string().min(1),
        secretAccessKey: z.string().optional(),
        forcePathStyle: z.boolean().default(true),
      })
      const parsed = schema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const existing = (
        await db
          .select({ secret: backupDestinationsTable.secretAccessKey })
          .from(backupDestinationsTable)
          .where(eq(backupDestinationsTable.serverId, serverId))
          .limit(1)
      )[0]
      const secret = parsed.data.secretAccessKey ?? existing?.secret
      if (secret === undefined || secret === "") {
        throw new ApiException("validation.failed", {
          status: 422,
          params: { field: "secretAccessKey" },
        })
      }
      const values = {
        endpoint: parsed.data.endpoint,
        region: parsed.data.region,
        bucket: parsed.data.bucket,
        prefix: parsed.data.prefix,
        accessKeyId: parsed.data.accessKeyId,
        secretAccessKey: secret,
        forcePathStyle: parsed.data.forcePathStyle,
      }
      const [row] = await db
        .insert(backupDestinationsTable)
        .values({ serverId, ...values })
        .onConflictDoUpdate({
          target: backupDestinationsTable.serverId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning({ id: backupDestinationsTable.id })
      return c.json({ destinationId: row?.id ?? null })
    })
    .delete("/:serverId/destination", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      await db
        .delete(backupDestinationsTable)
        .where(eq(backupDestinationsTable.serverId, serverId))
      return c.json({ ok: true })
    })
    .delete("/:serverId/backups/:backupId", async (c) => {
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
