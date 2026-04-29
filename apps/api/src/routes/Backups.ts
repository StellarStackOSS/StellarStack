import { Hono } from "hono"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  backupDestinationsTable,
  backupsTable,
} from "@workspace/db/schema/backups"
import { serversTable } from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"
import type { Queues } from "@/queues"

const createBackupSchema = z.object({
  name: z.string().min(1).max(64),
  destinationId: z.string().uuid().optional(),
})

const upsertDestinationSchema = z.object({
  endpoint: z.string().url(),
  region: z.string().min(1).max(64),
  bucket: z.string().min(1).max(255),
  prefix: z.string().max(255).default(""),
  accessKeyId: z.string().min(1).max(255),
  secretAccessKey: z.string().min(1).max(255),
  forcePathStyle: z.boolean().default(true),
})

const requireServerAccess = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
) => {
  const server = (
    await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (server === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  if (user.isAdmin !== true && server.ownerId !== user.id) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  return server
}

/**
 * Per-server backup CRUD + S3 destination config. Mounted under
 * /servers/:id/backups so route guards inherit cleanly. Take/restore/delete
 * actions enqueue BullMQ jobs; the worker drives the daemon and updates
 * the row's `state` from "pending" to "ready" or "failed".
 */
export const buildBackupsRoute = (params: {
  auth: Auth
  db: Db
  queues: Queues
}) => {
  const { auth, db, queues } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/backups", async (c) => {
      const id = c.req.param("id")
      await requireServerAccess(db, c.get("user"), id)
      const rows = await db
        .select()
        .from(backupsTable)
        .where(eq(backupsTable.serverId, id))
        .orderBy(desc(backupsTable.createdAt))
      return c.json({ backups: rows })
    })
    .post("/:id/backups", async (c) => {
      const id = c.req.param("id")
      await requireServerAccess(db, c.get("user"), id)
      const parsed = createBackupSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      let storage: "local" | "s3" = "local"
      if (parsed.data.destinationId !== undefined) {
        const dest = (
          await db
            .select()
            .from(backupDestinationsTable)
            .where(
              and(
                eq(backupDestinationsTable.id, parsed.data.destinationId),
                eq(backupDestinationsTable.serverId, id)
              )
            )
            .limit(1)
        )[0]
        if (dest === undefined) {
          throw new ApiException("backups.s3_credentials_missing", {
            status: 404,
          })
        }
        storage = "s3"
      }
      const inserted = await db
        .insert(backupsTable)
        .values({
          serverId: id,
          name: parsed.data.name,
          storage,
          state: "pending",
        })
        .returning()
      const row = inserted[0]
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      await queues.backupCreate.add(
        "create",
        { backupId: row.id },
        { removeOnComplete: 100, removeOnFail: 100 }
      )
      return c.json({ backup: row }, 201)
    })
    .post("/:id/backups/:bid/restore", async (c) => {
      const id = c.req.param("id")
      const bid = c.req.param("bid")
      await requireServerAccess(db, c.get("user"), id)
      const backup = (
        await db
          .select()
          .from(backupsTable)
          .where(and(eq(backupsTable.id, bid), eq(backupsTable.serverId, id)))
          .limit(1)
      )[0]
      if (backup === undefined) {
        throw new ApiException("backups.not_found", { status: 404 })
      }
      if (backup.state !== "ready") {
        throw new ApiException("servers.action.invalid_state", {
          status: 409,
          params: { state: backup.state },
        })
      }
      await queues.backupRestore.add(
        "restore",
        { backupId: backup.id },
        { removeOnComplete: 100, removeOnFail: 100 }
      )
      return c.json({ ok: true })
    })
    .delete("/:id/backups/:bid", async (c) => {
      const id = c.req.param("id")
      const bid = c.req.param("bid")
      await requireServerAccess(db, c.get("user"), id)
      const backup = (
        await db
          .select()
          .from(backupsTable)
          .where(and(eq(backupsTable.id, bid), eq(backupsTable.serverId, id)))
          .limit(1)
      )[0]
      if (backup === undefined) {
        throw new ApiException("backups.not_found", { status: 404 })
      }
      if (backup.locked) {
        throw new ApiException("backups.locked", { status: 409 })
      }
      await queues.backupDelete.add(
        "delete",
        { backupId: backup.id },
        { removeOnComplete: 100, removeOnFail: 100 }
      )
      return c.json({ ok: true })
    })
    .post("/:id/backups/:bid/lock", async (c) => {
      const id = c.req.param("id")
      const bid = c.req.param("bid")
      await requireServerAccess(db, c.get("user"), id)
      const parsed = z
        .object({ locked: z.boolean() })
        .safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const updated = await db
        .update(backupsTable)
        .set({ locked: parsed.data.locked })
        .where(and(eq(backupsTable.id, bid), eq(backupsTable.serverId, id)))
        .returning()
      if (updated[0] === undefined) {
        throw new ApiException("backups.not_found", { status: 404 })
      }
      return c.json({ backup: updated[0] })
    })
    .get("/:id/destination", async (c) => {
      const id = c.req.param("id")
      await requireServerAccess(db, c.get("user"), id)
      const rows = await db
        .select()
        .from(backupDestinationsTable)
        .where(eq(backupDestinationsTable.serverId, id))
        .limit(1)
      const row = rows[0] ?? null
      if (row === null) {
        return c.json({ destination: null })
      }
      return c.json({
        destination: {
          id: row.id,
          serverId: row.serverId,
          endpoint: row.endpoint,
          region: row.region,
          bucket: row.bucket,
          prefix: row.prefix,
          accessKeyId: row.accessKeyId,
          forcePathStyle: row.forcePathStyle,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      })
    })
    .put("/:id/destination", async (c) => {
      const id = c.req.param("id")
      await requireServerAccess(db, c.get("user"), id)
      const parsed = upsertDestinationSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const existing = (
        await db
          .select()
          .from(backupDestinationsTable)
          .where(eq(backupDestinationsTable.serverId, id))
          .limit(1)
      )[0]
      if (existing === undefined) {
        const inserted = await db
          .insert(backupDestinationsTable)
          .values({
            serverId: id,
            endpoint: parsed.data.endpoint,
            region: parsed.data.region,
            bucket: parsed.data.bucket,
            prefix: parsed.data.prefix,
            accessKeyId: parsed.data.accessKeyId,
            secretAccessKey: parsed.data.secretAccessKey,
            forcePathStyle: parsed.data.forcePathStyle,
          })
          .returning()
        return c.json({ destinationId: inserted[0]?.id }, 201)
      }
      await db
        .update(backupDestinationsTable)
        .set({
          endpoint: parsed.data.endpoint,
          region: parsed.data.region,
          bucket: parsed.data.bucket,
          prefix: parsed.data.prefix,
          accessKeyId: parsed.data.accessKeyId,
          secretAccessKey: parsed.data.secretAccessKey,
          forcePathStyle: parsed.data.forcePathStyle,
          updatedAt: new Date(),
        })
        .where(eq(backupDestinationsTable.id, existing.id))
      return c.json({ destinationId: existing.id })
    })
    .delete("/:id/destination", async (c) => {
      const id = c.req.param("id")
      await requireServerAccess(db, c.get("user"), id)
      await db
        .delete(backupDestinationsTable)
        .where(eq(backupDestinationsTable.serverId, id))
      return c.json({ ok: true })
    })
}
