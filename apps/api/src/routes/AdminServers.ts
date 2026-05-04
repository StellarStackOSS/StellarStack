import { and, eq, isNull, sum } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { InstallRunner } from "@/lib/InstallRunner"
import type { StatusCache } from "@/lib/StatusCache"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"
import type { AuthVariables } from "@/middleware/RequireSession"

const updateServerSchema = z.object({
  memoryLimitMb: z.number().int().positive().optional(),
  cpuLimitPercent: z.number().int().positive().optional(),
  diskLimitMb: z.number().int().positive().optional(),
  blueprintId: z.string().uuid().optional(),
  dockerImage: z.string().min(1).optional(),
  ownerId: z.string().uuid().optional(),
})

const variablesSchema = z.object({
  variables: z.record(z.string(), z.string()),
})

const allocationActionSchema = z.object({
  allocationId: z.string().uuid(),
})

const reinstallSchema = z.object({
  keepFiles: z.boolean().default(false),
  snapshotFirst: z.boolean().default(false),
})

const adminCreateSchema = z.object({
  name: z.string().min(1).max(120),
  ownerId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  nodeId: z.string().uuid(),
  dockerImage: z.string().min(1),
  memoryLimitMb: z.number().int().positive(),
  cpuLimitPercent: z.number().int().positive(),
  diskLimitMb: z.number().int().positive(),
  variables: z.record(z.string(), z.string()).default({}),
})

export const buildAdminServersRoute = (params: {
  auth: Auth
  db: Db
  installRunner: InstallRunner
  statusCache: StatusCache
}) => {
  const { auth, db, installRunner, statusCache } = params
  const adminMiddleware = buildRequireAdmin(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", ...adminMiddleware)
    .get("/", async (c) => {
      const rows = await db
        .select({
          id: serversTable.id,
          name: serversTable.name,
          status: serversTable.status,
          suspended: serversTable.suspended,
          memoryLimitMb: serversTable.memoryLimitMb,
          cpuLimitPercent: serversTable.cpuLimitPercent,
          diskLimitMb: serversTable.diskLimitMb,
          dockerImage: serversTable.dockerImage,
          blueprintId: serversTable.blueprintId,
          createdAt: serversTable.createdAt,
          ownerId: serversTable.ownerId,
          nodeId: serversTable.nodeId,
          ownerEmail: usersTable.email,
          ownerName: usersTable.name,
          nodeName: nodesTable.name,
          nodeFqdn: nodesTable.fqdn,
        })
        .from(serversTable)
        .leftJoin(usersTable, eq(usersTable.id, serversTable.ownerId))
        .leftJoin(nodesTable, eq(nodesTable.id, serversTable.nodeId))
      return c.json({ servers: rows })
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const server = (
        await db
          .select()
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (server === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      const [variables, allocations, blueprint] = await Promise.all([
        db
          .select()
          .from(serverVariablesTable)
          .where(eq(serverVariablesTable.serverId, id)),
        db
          .select({
            id: nodeAllocationsTable.id,
            nodeId: nodeAllocationsTable.nodeId,
            ip: nodeAllocationsTable.ip,
            port: nodeAllocationsTable.port,
            alias: nodeAllocationsTable.alias,
            serverId: nodeAllocationsTable.serverId,
          })
          .from(nodeAllocationsTable)
          .innerJoin(
            serverAllocationsTable,
            eq(serverAllocationsTable.allocationId, nodeAllocationsTable.id)
          )
          .where(eq(serverAllocationsTable.serverId, id)),
        db
          .select({
            id: blueprintsTable.id,
            name: blueprintsTable.name,
            dockerImages: blueprintsTable.dockerImages,
            variables: blueprintsTable.variables,
          })
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, server.blueprintId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ])
      return c.json({ server, variables, allocations, blueprint })
    })
    .post("/", async (c) => {
      const parsed = adminCreateSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const input = parsed.data
      const [blueprint, node, allocation] = await Promise.all([
        db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, input.blueprintId))
          .limit(1)
          .then((r) => r[0]),
        db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, input.nodeId))
          .limit(1)
          .then((r) => r[0]),
        db
          .select()
          .from(nodeAllocationsTable)
          .where(
            and(
              eq(nodeAllocationsTable.nodeId, input.nodeId),
              isNull(nodeAllocationsTable.serverId)
            )
          )
          .limit(1)
          .then((r) => r[0]),
      ])
      if (blueprint === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      if (allocation === undefined) {
        throw new ApiException("servers.create.no_free_allocation", {
          status: 409,
        })
      }
      if (!Object.values(blueprint.dockerImages).includes(input.dockerImage)) {
        throw new ApiException("servers.startup.invalid_docker_image", {
          status: 422,
        })
      }
      const usage = (
        await db
          .select({
            memoryUsed: sum(serversTable.memoryLimitMb),
            diskUsed: sum(serversTable.diskLimitMb),
          })
          .from(serversTable)
          .where(eq(serversTable.nodeId, input.nodeId))
      )[0]
      const memoryUsed = Number(usage?.memoryUsed ?? 0)
      const diskUsed = Number(usage?.diskUsed ?? 0)
      if (memoryUsed + input.memoryLimitMb > node.memoryTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: { node: node.name },
        })
      }
      if (diskUsed + input.diskLimitMb > node.diskTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: { node: node.name },
        })
      }

      const inserted = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(serversTable)
          .values({
            ownerId: input.ownerId,
            nodeId: input.nodeId,
            blueprintId: input.blueprintId,
            primaryAllocationId: allocation.id,
            name: input.name,
            description: null,
            memoryLimitMb: input.memoryLimitMb,
            cpuLimitPercent: input.cpuLimitPercent,
            diskLimitMb: input.diskLimitMb,
            dockerImage: input.dockerImage,
            startupExtra: null,
            status: "offline",
            installState: "pending",
          })
          .returning()
        if (row === undefined) throw new Error("insert failed")
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: row.id })
          .where(eq(nodeAllocationsTable.id, allocation.id))
        await tx
          .insert(serverAllocationsTable)
          .values({ serverId: row.id, allocationId: allocation.id })
        const variableRows = Object.entries(input.variables).map(
          ([key, value]) => ({ serverId: row.id, variableKey: key, value })
        )
        if (variableRows.length > 0) {
          await tx.insert(serverVariablesTable).values(variableRows)
        }
        return row
      })
      void installRunner.enqueue(inserted.id)
      return c.json({ server: inserted })
    })
    .patch("/:id", async (c) => {
      const id = c.req.param("id")
      const parsed = updateServerSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db
        .update(serversTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true })
    })
    .put("/:id/variables", async (c) => {
      const id = c.req.param("id")
      const parsed = variablesSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db.transaction(async (tx) => {
        await tx
          .delete(serverVariablesTable)
          .where(eq(serverVariablesTable.serverId, id))
        const rows = Object.entries(parsed.data.variables).map(([k, v]) => ({
          serverId: id,
          variableKey: k,
          value: v,
        }))
        if (rows.length > 0) {
          await tx.insert(serverVariablesTable).values(rows)
        }
      })
      return c.json({ ok: true })
    })
    .post("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const parsed = allocationActionSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db.transaction(async (tx) => {
        await tx
          .insert(serverAllocationsTable)
          .values({ serverId: id, allocationId: parsed.data.allocationId })
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: id })
          .where(eq(nodeAllocationsTable.id, parsed.data.allocationId))
      })
      return c.json({ ok: true })
    })
    .delete("/:id/allocations/:allocId", async (c) => {
      const id = c.req.param("id")
      const allocId = c.req.param("allocId")
      const server = (
        await db
          .select({ primary: serversTable.primaryAllocationId })
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (server?.primary === allocId) {
        throw new ApiException("servers.cannot_remove_primary_allocation", {
          status: 409,
        })
      }
      await db.transaction(async (tx) => {
        await tx
          .delete(serverAllocationsTable)
          .where(
            and(
              eq(serverAllocationsTable.serverId, id),
              eq(serverAllocationsTable.allocationId, allocId)
            )
          )
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: null })
          .where(eq(nodeAllocationsTable.id, allocId))
      })
      return c.json({ ok: true })
    })
    .patch("/:id/primary-allocation", async (c) => {
      const id = c.req.param("id")
      const parsed = allocationActionSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db
        .update(serversTable)
        .set({ primaryAllocationId: parsed.data.allocationId, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true })
    })
    .post("/:id/reinstall", async (c) => {
      const id = c.req.param("id")
      const parsed = reinstallSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      // For now: just re-enqueue an install. snapshotFirst / keepFiles
      // semantics live in the daemon and will be wired in phase 3.
      await db
        .update(serversTable)
        .set({ installState: "pending", updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      void installRunner.enqueue(id)
      return c.json({ ok: true })
    })
    .patch("/:id/suspend", async (c) => {
      const id = c.req.param("id")
      const row = (
        await db
          .select({ suspended: serversTable.suspended })
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (row === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      const next = !row.suspended
      await db
        .update(serversTable)
        .set({ suspended: next, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true, suspended: next })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      await db.transaction(async (tx) => {
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: null })
          .where(eq(nodeAllocationsTable.serverId, id))
        await tx.delete(serversTable).where(eq(serversTable.id, id))
      })
      await statusCache.set(id, "offline")
      return c.json({ ok: true })
    })
}
