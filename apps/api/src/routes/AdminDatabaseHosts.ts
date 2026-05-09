import { and, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  databaseHostsTable,
  databasesTable,
} from "@workspace/db/schema/databases"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import {
  DATABASE_TYPES,
  isDatabaseTypeKey,
  substituteRootEnv,
} from "@workspace/shared/databases"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import { encryptSecret, generatePassword } from "@/lib/Crypto"
import { callDaemon } from "@/lib/DaemonHttp"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"
import type { AuthVariables } from "@/middleware/RequireSession"

const createSchema = z.object({
  name: z.string().min(1).max(120),
  nodeId: z.string().uuid(),
  dbType: z.string().min(1),
  memoryLimitMb: z.number().int().positive(),
  diskLimitMb: z.number().int().positive(),
  shared: z.boolean().default(true),
})

const patchSchema = z.object({
  shared: z.boolean().optional(),
  suspended: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
})

export const buildAdminDatabaseHostsRoute = (params: {
  auth: Auth
  db: Db
  env: Env
}) => {
  const { auth, db, env } = params
  const adminMiddleware = buildRequireAdmin(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", ...adminMiddleware)
    .get("/", async (c) => {
      const rows = await db
        .select({
          id: databaseHostsTable.id,
          name: databaseHostsTable.name,
          nodeId: databaseHostsTable.nodeId,
          dbType: databaseHostsTable.dbType,
          memoryLimitMb: databaseHostsTable.memoryLimitMb,
          diskLimitMb: databaseHostsTable.diskLimitMb,
          status: databaseHostsTable.status,
          suspended: databaseHostsTable.suspended,
          shared: databaseHostsTable.shared,
          createdAt: databaseHostsTable.createdAt,
          nodeName: nodesTable.name,
          allocationIp: nodeAllocationsTable.ip,
          allocationPort: nodeAllocationsTable.port,
        })
        .from(databaseHostsTable)
        .leftJoin(nodesTable, eq(nodesTable.id, databaseHostsTable.nodeId))
        .leftJoin(
          nodeAllocationsTable,
          eq(nodeAllocationsTable.id, databaseHostsTable.allocationId)
        )
      return c.json({ hosts: rows })
    })
    .get("/types", (c) => {
      const types = Object.values(DATABASE_TYPES).map((t) => ({
        key: t.key,
        label: t.label,
        driver: t.driver,
        defaultPort: t.defaultPort,
      }))
      return c.json({ types })
    })
    .post("/", async (c) => {
      const parsed = createSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const input = parsed.data

      if (!isDatabaseTypeKey(input.dbType)) {
        throw new ApiException("databases.unknown_type", { status: 422 })
      }
      const type = DATABASE_TYPES[input.dbType]

      const node = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, input.nodeId))
          .limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      if (node.daemonPublicKey === null) {
        throw new ApiException("nodes.not_paired", { status: 409 })
      }

      const allocation = (
        await db
          .select()
          .from(nodeAllocationsTable)
          .where(
            and(
              eq(nodeAllocationsTable.nodeId, input.nodeId),
              isNull(nodeAllocationsTable.serverId)
            )
          )
          .limit(1)
      )[0]
      if (allocation === undefined) {
        throw new ApiException("databases.no_free_allocation", { status: 409 })
      }

      const rootPassword = generatePassword(32)
      const env = substituteRootEnv(type.rootEnv, rootPassword)

      // Insert the row first so we have a UUID. If the daemon call fails
      // we'll undo. Allocation is reserved using a sentinel pattern: we
      // reuse the `serverId` column with the host's UUID since the daemon
      // pool model doesn't yet split allocation kinds.
      const [host] = await db
        .insert(databaseHostsTable)
        .values({
          name: input.name,
          nodeId: input.nodeId,
          allocationId: allocation.id,
          dbType: input.dbType,
          rootUser: type.rootUser,
          rootPasswordEncrypted: encryptSecret(
            rootPassword,
            params.env.BETTER_AUTH_SECRET
          ),
          memoryLimitMb: input.memoryLimitMb,
          diskLimitMb: input.diskLimitMb,
          shared: input.shared,
          status: "starting",
        })
        .returning()
      if (host === undefined) throw new Error("insert failed")
      await db
        .update(nodeAllocationsTable)
        .set({ serverId: host.id })
        .where(eq(nodeAllocationsTable.id, allocation.id))

      try {
        const res = await callDaemon({
          baseUrl: `${node.scheme}://${node.fqdn}:${node.daemonPort}`,
          nodeId: node.id,
          signingKeyHex: node.daemonPublicKey,
          method: "POST",
          path: `/api/databases/${host.id}`,
          body: {
            host_uuid: host.id,
            image: type.image,
            host_port: allocation.port,
            container_port: type.defaultPort,
            env,
            memory_limit_mb: input.memoryLimitMb,
            disk_limit_mb: input.diskLimitMb,
          },
        })
        if (!res.ok) throw new Error(`daemon returned ${res.status}`)
      } catch (err) {
        console.error(`db host ${host.id}: provision failed`, err)
        await db
          .update(nodeAllocationsTable)
          .set({ serverId: null })
          .where(eq(nodeAllocationsTable.id, allocation.id))
        await db
          .delete(databaseHostsTable)
          .where(eq(databaseHostsTable.id, host.id))
        throw new ApiException("databases.provision_failed", { status: 502 })
      }

      await db
        .update(databaseHostsTable)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(databaseHostsTable.id, host.id))

      return c.json({ host: { ...host, status: "running" } })
    })
    .patch("/:id", async (c) => {
      const id = c.req.param("id")
      const parsed = patchSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db
        .update(databaseHostsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(databaseHostsTable.id, id))
      return c.json({ ok: true })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      const host = (
        await db
          .select()
          .from(databaseHostsTable)
          .where(eq(databaseHostsTable.id, id))
          .limit(1)
      )[0]
      if (host === undefined) {
        throw new ApiException("databases.host_not_found", { status: 404 })
      }
      const dbCount = (
        await db
          .select({ id: databasesTable.id })
          .from(databasesTable)
          .where(eq(databasesTable.hostId, id))
      ).length
      if (dbCount > 0) {
        throw new ApiException("databases.host_has_databases", { status: 409 })
      }
      const node = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, host.nodeId))
          .limit(1)
      )[0]
      if (node !== undefined && node.daemonPublicKey !== null) {
        try {
          await callDaemon({
            baseUrl: `${node.scheme}://${node.fqdn}:${node.daemonPort}`,
            nodeId: node.id,
            signingKeyHex: node.daemonPublicKey,
            method: "DELETE",
            path: `/api/databases/${id}`,
          })
        } catch (err) {
          console.warn(`db host ${id}: daemon delete failed`, err)
        }
      }
      await db
        .update(nodeAllocationsTable)
        .set({ serverId: null })
        .where(eq(nodeAllocationsTable.id, host.allocationId))
      await db
        .delete(databaseHostsTable)
        .where(eq(databaseHostsTable.id, id))
      return c.json({ ok: true })
    })
}
