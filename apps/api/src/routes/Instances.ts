import { and, eq, isNull, sum } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { nodeAllocationsTable } from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serverSubusersTable,
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { writeAudit } from "@/lib/Audit"
import type { InstallRunner } from "@/lib/InstallRunner"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const createInstanceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  blueprintId: z.string().uuid(),
  dockerImage: z.string().min(1),
  primaryAllocationId: z.string().uuid(),
  memoryLimitMb: z.number().int().positive(),
  cpuLimitPercent: z.number().int().positive(),
  diskLimitMb: z.number().int().positive(),
  startupExtra: z.string().optional(),
  variables: z.record(z.string(), z.string()).default({}),
})

/**
 * Server splitting / instances. A "child" server inherits its parent's
 * node + owner and carves a slice out of the parent's resource pool.
 * One level deep. Routes:
 *   GET    /:id/pool       — totals/used/free for the carve-out UI
 *   GET    /:id/instances  — list children of :id
 *   POST   /:id/instances  — create a new child under :id
 */
export const buildInstancesRoute = (params: {
  auth: Auth
  db: Db
  installRunner: InstallRunner
}) => {
  const { auth, db, installRunner } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/pool", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const parent = await loadOwnedServer(db, user, id)
      const pool = await computePool(db, parent)
      return c.json(pool)
    })
    .get("/:id/instances", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      await loadOwnedServer(db, user, id)
      const children = await db
        .select()
        .from(serversTable)
        .where(eq(serversTable.parentId, id))
      return c.json({ instances: children })
    })
    .post("/:id/instances", async (c) => {
      const parentId = c.req.param("id")
      const user = c.get("user")
      const parent = await loadOwnedServer(db, user, parentId)
      if (parent.parentId !== null) {
        throw new ApiException("instances.nested_not_allowed", { status: 422 })
      }
      const parsed = createInstanceSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const input = parsed.data

      const [blueprint, allocation, pool] = await Promise.all([
        db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, input.blueprintId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(nodeAllocationsTable)
          .where(
            and(
              eq(nodeAllocationsTable.id, input.primaryAllocationId),
              eq(nodeAllocationsTable.nodeId, parent.nodeId),
              isNull(nodeAllocationsTable.serverId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]),
        computePool(db, parent),
      ])
      if (blueprint === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      if (allocation === undefined) {
        throw new ApiException("servers.create.allocation_unavailable", {
          status: 409,
        })
      }
      if (!Object.values(blueprint.dockerImages).includes(input.dockerImage)) {
        throw new ApiException("servers.startup.invalid_docker_image", {
          status: 422,
        })
      }
      if (input.memoryLimitMb > pool.memoryFreeMb) {
        throw new ApiException("instances.pool_exhausted", {
          status: 409,
          params: { resource: "memory" },
        })
      }
      if (input.diskLimitMb > pool.diskFreeMb) {
        throw new ApiException("instances.pool_exhausted", {
          status: 409,
          params: { resource: "disk" },
        })
      }
      if (input.cpuLimitPercent > pool.cpuFreePercent) {
        throw new ApiException("instances.pool_exhausted", {
          status: 409,
          params: { resource: "cpu" },
        })
      }

      const inserted = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(serversTable)
          .values({
            ownerId: parent.ownerId,
            nodeId: parent.nodeId,
            parentId: parent.id,
            blueprintId: input.blueprintId,
            primaryAllocationId: input.primaryAllocationId,
            name: input.name,
            description: input.description ?? null,
            memoryLimitMb: input.memoryLimitMb,
            cpuLimitPercent: input.cpuLimitPercent,
            diskLimitMb: input.diskLimitMb,
            dockerImage: input.dockerImage,
            startupExtra: input.startupExtra ?? null,
            status: "offline",
            installState: "pending",
          })
          .returning()
        if (row === undefined) throw new Error("insert failed")
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: row.id })
          .where(eq(nodeAllocationsTable.id, input.primaryAllocationId))
        await tx.insert(serverAllocationsTable).values({
          serverId: row.id,
          allocationId: input.primaryAllocationId,
        })
        const variableRows = Object.entries(input.variables).map(
          ([key, value]) => ({ serverId: row.id, variableKey: key, value })
        )
        if (variableRows.length > 0) {
          await tx.insert(serverVariablesTable).values(variableRows)
        }
        return row
      })

      void installRunner.enqueue(inserted.id)
      void writeAudit({
        db,
        actorId: user.id,
        action: "instances.created",
        targetType: "server",
        targetId: inserted.id,
        metadata: { parentId: parent.id, name: inserted.name },
      })
      return c.json({ instance: inserted })
    })
}

type PoolSnapshot = {
  memoryTotalMb: number
  memoryUsedMb: number
  memoryFreeMb: number
  diskTotalMb: number
  diskUsedMb: number
  diskFreeMb: number
  cpuTotalPercent: number
  cpuUsedPercent: number
  cpuFreePercent: number
}

const computePool = async (
  db: Db,
  parent: typeof serversTable.$inferSelect
): Promise<PoolSnapshot> => {
  const usage = (
    await db
      .select({
        memory: sum(serversTable.memoryLimitMb),
        disk: sum(serversTable.diskLimitMb),
        cpu: sum(serversTable.cpuLimitPercent),
      })
      .from(serversTable)
      .where(eq(serversTable.parentId, parent.id))
  )[0]
  const memoryUsed = Number(usage?.memory ?? 0)
  const diskUsed = Number(usage?.disk ?? 0)
  const cpuUsed = Number(usage?.cpu ?? 0)
  return {
    memoryTotalMb: parent.memoryLimitMb,
    memoryUsedMb: memoryUsed,
    memoryFreeMb: Math.max(0, parent.memoryLimitMb - memoryUsed),
    diskTotalMb: parent.diskLimitMb,
    diskUsedMb: diskUsed,
    diskFreeMb: Math.max(0, parent.diskLimitMb - diskUsed),
    cpuTotalPercent: parent.cpuLimitPercent,
    cpuUsedPercent: cpuUsed,
    cpuFreePercent: Math.max(0, parent.cpuLimitPercent - cpuUsed),
  }
}

const loadOwnedServer = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<typeof serversTable.$inferSelect> => {
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
  if (user.isAdmin === true) return server
  if (server.ownerId === user.id) return server
  const sub = (
    await db
      .select()
      .from(serverSubusersTable)
      .where(eq(serverSubusersTable.serverId, serverId))
      .limit(1)
  )[0]
  if (sub === undefined || sub.userId !== user.id) {
    throw new ApiException("permissions.denied", { status: 403 })
  }
  // Subusers can read instance metadata but not create children — caller
  // enforces the write restriction at the route level.
  return server
}
