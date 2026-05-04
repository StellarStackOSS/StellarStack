import { and, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"

import type { Db } from "@workspace/db/client.types"
import { nodeAllocationsTable } from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

/**
 * Per-server allocation management. The owner / admin can list, request
 * a random allocation from the pool, set a different one as primary, or
 * unassign one (provided it isn't the primary).
 */
export const buildServerAllocationsRoute = (params: {
  auth: Auth
  db: Db
}) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/allocations", async (c) => {
      const serverId = c.req.param("serverId")
      const server = await assertOwner(db, c.get("user"), serverId)
      const allocations = await db
        .select({
          id: nodeAllocationsTable.id,
          nodeId: nodeAllocationsTable.nodeId,
          ip: nodeAllocationsTable.ip,
          port: nodeAllocationsTable.port,
          alias: nodeAllocationsTable.alias,
          serverId: nodeAllocationsTable.serverId,
          createdAt: nodeAllocationsTable.createdAt,
        })
        .from(nodeAllocationsTable)
        .innerJoin(
          serverAllocationsTable,
          eq(serverAllocationsTable.allocationId, nodeAllocationsTable.id)
        )
        .where(eq(serverAllocationsTable.serverId, serverId))
      return c.json({
        allocations,
        primaryAllocationId: server.primaryAllocationId,
        allocationLimit: server.allocationLimit,
      })
    })
    .post("/:serverId/allocations/random", async (c) => {
      const serverId = c.req.param("serverId")
      const server = await assertOwner(db, c.get("user"), serverId)
      const free = (
        await db
          .select()
          .from(nodeAllocationsTable)
          .where(
            and(
              eq(nodeAllocationsTable.nodeId, server.nodeId),
              isNull(nodeAllocationsTable.serverId)
            )
          )
          .limit(1)
      )[0]
      if (free === undefined) {
        throw new ApiException("servers.create.no_free_allocation", {
          status: 409,
        })
      }
      await db.transaction(async (tx) => {
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId })
          .where(eq(nodeAllocationsTable.id, free.id))
        await tx
          .insert(serverAllocationsTable)
          .values({ serverId, allocationId: free.id })
      })
      return c.json({ allocation: { ...free, serverId } })
    })
    .patch("/:serverId/allocations/:allocId/primary", async (c) => {
      const serverId = c.req.param("serverId")
      const allocId = c.req.param("allocId")
      await assertOwner(db, c.get("user"), serverId)
      const link = (
        await db
          .select()
          .from(serverAllocationsTable)
          .where(
            and(
              eq(serverAllocationsTable.serverId, serverId),
              eq(serverAllocationsTable.allocationId, allocId)
            )
          )
          .limit(1)
      )[0]
      if (link === undefined) {
        throw new ApiException("servers.action.invalid_state", { status: 409 })
      }
      await db
        .update(serversTable)
        .set({ primaryAllocationId: allocId, updatedAt: new Date() })
        .where(eq(serversTable.id, serverId))
      return c.json({ ok: true })
    })
    .delete("/:serverId/allocations/:allocId", async (c) => {
      const serverId = c.req.param("serverId")
      const allocId = c.req.param("allocId")
      const server = await assertOwner(db, c.get("user"), serverId)
      if (server.primaryAllocationId === allocId) {
        throw new ApiException("servers.cannot_remove_primary_allocation", {
          status: 409,
        })
      }
      await db.transaction(async (tx) => {
        await tx
          .delete(serverAllocationsTable)
          .where(
            and(
              eq(serverAllocationsTable.serverId, serverId),
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
}

const assertOwner = async (
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
    throw new ApiException("permissions.denied", { status: 403 })
  }
  return server
}
