import { Hono } from "hono"
import { and, eq, isNull, sum } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import { clientIp, writeAudit } from "@/audit"
import type { AuthVariables } from "@/middleware/RequireSession"
import type { Queues } from "@/queues"

const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(255).optional(),
  ownerId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  nodeId: z.string().uuid(),
  dockerImage: z.string().min(1),
  memoryLimitMb: z.number().int().positive().max(1_048_576),
  cpuLimitPercent: z.number().int().positive().max(10_000),
  diskLimitMb: z.number().int().positive().max(10_485_760),
  variables: z.record(z.string(), z.string()).default({}),
})

const patchServerSchema = z.object({
  memoryLimitMb: z.number().int().positive().max(1_048_576).optional(),
  cpuLimitPercent: z.number().int().positive().max(10_000).optional(),
  diskLimitMb: z.number().int().positive().max(10_485_760).optional(),
  blueprintId: z.string().uuid().optional(),
  dockerImage: z.string().min(1).optional(),
  ownerId: z.string().uuid().optional(),
})

/**
 * Admin-only server management. Lists every server across all users and
 * exposes suspend/unsuspend, full edit, and delete actions without requiring
 * the actor to be the server owner.
 */
export const buildAdminServersRoute = (params: { db: Db; queues: Queues }) => {
  const { db, queues } = params

  return new Hono<{ Variables: AuthVariables }>()
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
        .leftJoin(usersTable, eq(serversTable.ownerId, usersTable.id))
        .leftJoin(nodesTable, eq(serversTable.nodeId, nodesTable.id))
        .orderBy(serversTable.createdAt)
      return c.json({ servers: rows })
    })
    .post("/", async (c) => {
      const parsed = createServerSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const actor = c.get("user")
      const input = parsed.data

      const owner = (
        await db.select().from(usersTable).where(eq(usersTable.id, input.ownerId)).limit(1)
      )[0]
      if (owner === undefined) {
        throw new ApiException("users.not_found", { status: 404 })
      }

      const blueprint = (
        await db.select().from(blueprintsTable).where(eq(blueprintsTable.id, input.blueprintId)).limit(1)
      )[0]
      if (blueprint === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      if (!Object.values(blueprint.dockerImages as Record<string, string>).includes(input.dockerImage)) {
        throw new ApiException("blueprints.invalid_image", { status: 422 })
      }

      const node = (
        await db.select().from(nodesTable).where(eq(nodesTable.id, input.nodeId)).limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }

      const usedRow = (
        await db
          .select({
            memoryUsed: sum(serversTable.memoryLimitMb),
            diskUsed: sum(serversTable.diskLimitMb),
          })
          .from(serversTable)
          .where(eq(serversTable.nodeId, input.nodeId))
      )[0]
      const memoryUsed = Number(usedRow?.memoryUsed ?? 0)
      const diskUsed = Number(usedRow?.diskUsed ?? 0)
      if (memoryUsed + input.memoryLimitMb > node.memoryTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: { node: node.name, available: node.memoryTotalMb - memoryUsed, requested: input.memoryLimitMb },
        })
      }
      if (diskUsed + input.diskLimitMb > node.diskTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: { node: node.name, available: node.diskTotalMb - diskUsed, requested: input.diskLimitMb },
        })
      }

      const serverRow = await db.transaction(async (tx) => {
        const allocationRow = (
          await tx
            .select()
            .from(nodeAllocationsTable)
            .where(and(eq(nodeAllocationsTable.nodeId, input.nodeId), isNull(nodeAllocationsTable.serverId)))
            .limit(1)
            .for("update")
        )[0]
        if (allocationRow === undefined) {
          throw new ApiException("servers.create.no_free_allocation", { status: 409 })
        }

        const inserted = await tx
          .insert(serversTable)
          .values({
            ownerId: input.ownerId,
            nodeId: input.nodeId,
            blueprintId: input.blueprintId,
            primaryAllocationId: allocationRow.id,
            name: input.name,
            description: input.description ?? null,
            memoryLimitMb: input.memoryLimitMb,
            cpuLimitPercent: input.cpuLimitPercent,
            diskLimitMb: input.diskLimitMb,
            dockerImage: input.dockerImage,
            status: "installing",
            suspended: false,
          })
          .returning()
        const created = inserted[0]
        if (created === undefined) {
          throw new ApiException("internal.unexpected", { status: 500 })
        }

        await tx.update(nodeAllocationsTable).set({ serverId: created.id }).where(eq(nodeAllocationsTable.id, allocationRow.id))
        await tx.insert(serverAllocationsTable).values({ serverId: created.id, allocationId: allocationRow.id })

        const variableRows = (blueprint.variables as Array<{ key: string; default: string }>).map((v) => ({
          serverId: created.id,
          variableKey: v.key,
          value: input.variables[v.key] ?? v.default,
        }))
        if (variableRows.length > 0) {
          await tx.insert(serverVariablesTable).values(variableRows)
        }

        return created
      })

      await queues.serverInstall.add("install", { serverId: serverRow.id }, { removeOnComplete: 100, removeOnFail: 100 })

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.create",
        targetType: "server",
        targetId: serverRow.id,
        metadata: { name: serverRow.name, nodeId: serverRow.nodeId, ownerId: serverRow.ownerId },
      })

      return c.json({ server: serverRow }, 201)
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
          .select()
          .from(nodeAllocationsTable)
          .where(eq(nodeAllocationsTable.serverId, id)),
        db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, server.blueprintId))
          .limit(1)
          .then((r) => r[0]),
      ])

      return c.json({ server, variables, allocations, blueprint: blueprint ?? null })
    })
    .patch("/:id", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

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

      const parsed = patchServerSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)

      const { blueprintId, dockerImage, ownerId, ...resourceUpdates } = parsed.data

      if (blueprintId !== undefined && blueprintId !== server.blueprintId) {
        const bp = (
          await db
            .select({ id: blueprintsTable.id, dockerImages: blueprintsTable.dockerImages })
            .from(blueprintsTable)
            .where(eq(blueprintsTable.id, blueprintId))
            .limit(1)
        )[0]
        if (bp === undefined) {
          throw new ApiException("blueprints.not_found", { status: 404 })
        }
        if (
          dockerImage !== undefined &&
          !Object.values(bp.dockerImages as Record<string, string>).includes(dockerImage)
        ) {
          throw new ApiException("blueprints.invalid_image", { status: 422 })
        }
      }

      if (ownerId !== undefined) {
        const owner = (
          await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.id, ownerId))
            .limit(1)
        )[0]
        if (owner === undefined) {
          throw new ApiException("auth.session.invalid", { status: 404 })
        }
      }

      const updates: Partial<typeof serversTable.$inferInsert> = {
        updatedAt: new Date(),
        ...resourceUpdates,
        ...(blueprintId !== undefined ? { blueprintId } : {}),
        ...(dockerImage !== undefined ? { dockerImage } : {}),
        ...(ownerId !== undefined ? { ownerId } : {}),
      }

      await db.update(serversTable).set(updates).where(eq(serversTable.id, id))

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.update",
        targetType: "server",
        targetId: id,
        metadata: { name: server.name },
      })

      return c.json({ ok: true })
    })
    .put("/:id/variables", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

      const server = (
        await db
          .select({ id: serversTable.id, name: serversTable.name })
          .from(serversTable)
          .where(eq(serversTable.id, id))
          .limit(1)
      )[0]
      if (server === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }

      const parsed = z
        .object({ variables: z.record(z.string(), z.string()) })
        .safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)

      await db.delete(serverVariablesTable).where(eq(serverVariablesTable.serverId, id))

      const rows = Object.entries(parsed.data.variables).map(([key, value]) => ({
        serverId: id,
        variableKey: key,
        value,
      }))
      if (rows.length > 0) {
        await db.insert(serverVariablesTable).values(rows)
      }

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.variables.update",
        targetType: "server",
        targetId: id,
        metadata: { name: server.name },
      })

      return c.json({ ok: true })
    })
    .post("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

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

      const parsed = z
        .object({ allocationId: z.string().uuid() })
        .safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)

      const allocation = (
        await db
          .select()
          .from(nodeAllocationsTable)
          .where(
            and(
              eq(nodeAllocationsTable.id, parsed.data.allocationId),
              eq(nodeAllocationsTable.nodeId, server.nodeId),
              isNull(nodeAllocationsTable.serverId)
            )
          )
          .limit(1)
      )[0]
      if (allocation === undefined) {
        throw new ApiException("transfers.allocation_unavailable", { status: 422 })
      }

      await db
        .update(nodeAllocationsTable)
        .set({ serverId: id })
        .where(eq(nodeAllocationsTable.id, parsed.data.allocationId))

      await db.insert(serverAllocationsTable).values({
        serverId: id,
        allocationId: parsed.data.allocationId,
      })

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.allocation.add",
        targetType: "server",
        targetId: id,
        metadata: { allocationId: parsed.data.allocationId },
      })

      return c.json({ ok: true })
    })
    .delete("/:id/allocations/:allocationId", async (c) => {
      const { id, allocationId } = c.req.param()
      const actor = c.get("user")

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

      if (server.primaryAllocationId === allocationId) {
        throw new ApiException("servers.cannot_remove_primary_allocation", { status: 422 })
      }

      await db
        .update(nodeAllocationsTable)
        .set({ serverId: null })
        .where(eq(nodeAllocationsTable.id, allocationId))

      await db
        .delete(serverAllocationsTable)
        .where(
          and(
            eq(serverAllocationsTable.serverId, id),
            eq(serverAllocationsTable.allocationId, allocationId)
          )
        )

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.allocation.remove",
        targetType: "server",
        targetId: id,
        metadata: { allocationId },
      })

      return c.json({ ok: true })
    })
    .patch("/:id/primary-allocation", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

      const parsed = z
        .object({ allocationId: z.string().uuid() })
        .safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)

      const binding = (
        await db
          .select()
          .from(serverAllocationsTable)
          .where(
            and(
              eq(serverAllocationsTable.serverId, id),
              eq(serverAllocationsTable.allocationId, parsed.data.allocationId)
            )
          )
          .limit(1)
      )[0]
      if (binding === undefined) {
        throw new ApiException("transfers.allocation_unavailable", { status: 422 })
      }

      await db
        .update(serversTable)
        .set({ primaryAllocationId: parsed.data.allocationId, updatedAt: new Date() })
        .where(eq(serversTable.id, id))

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.primary_allocation.set",
        targetType: "server",
        targetId: id,
        metadata: { allocationId: parsed.data.allocationId },
      })

      return c.json({ ok: true })
    })
    .post("/:id/reinstall", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

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

      const parsed = z
        .object({
          keepFiles: z.boolean().default(false),
          snapshotFirst: z.boolean().default(false),
        })
        .safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)

      await db
        .update(serversTable)
        .set({ status: "installing", updatedAt: new Date() })
        .where(eq(serversTable.id, id))

      await queues.serverInstall.add(
        "install",
        {
          serverId: id,
          reinstall: true,
          keepFiles: parsed.data.keepFiles,
          snapshotFirst: parsed.data.snapshotFirst,
        },
        { removeOnComplete: 100, removeOnFail: 100 }
      )

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.reinstall",
        targetType: "server",
        targetId: id,
        metadata: { name: server.name, keepFiles: parsed.data.keepFiles },
      })

      return c.json({ ok: true })
    })
    .patch("/:id/suspend", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

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

      const suspended = !server.suspended
      await db
        .update(serversTable)
        .set({ suspended, updatedAt: new Date() })
        .where(eq(serversTable.id, id))

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: suspended ? "server.suspend" : "server.unsuspend",
        targetType: "server",
        targetId: id,
        metadata: { name: server.name },
      })

      return c.json({ ok: true, suspended })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      const actor = c.get("user")

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

      await queues.serverDelete.add(
        "delete",
        { serverId: id },
        { removeOnComplete: 100, removeOnFail: 100 }
      )

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "server.delete",
        targetType: "server",
        targetId: id,
        metadata: { name: server.name },
      })

      return c.json({ ok: true })
    })
}
