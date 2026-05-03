import { Hono } from "hono"
import { and, count, eq, isNull } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { nodeAllocationsTable } from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException } from "@workspace/shared/errors"

import { loadServerAccess } from "@/access"
import type { Auth } from "@/auth"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

/**
 * User-facing allocation management for a single server.
 * Mounted under `/servers` so routes are `/servers/:id/allocations`.
 *
 * Limits are enforced by `allocationLimit` on the server row (default 3).
 * Owners and admins can manage allocations; subusers cannot.
 */
export const buildServerAllocationsRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      const rows = await db
        .select({
          id: nodeAllocationsTable.id,
          nodeId: nodeAllocationsTable.nodeId,
          ip: nodeAllocationsTable.ip,
          port: nodeAllocationsTable.port,
          alias: nodeAllocationsTable.alias,
          serverId: nodeAllocationsTable.serverId,
          createdAt: nodeAllocationsTable.createdAt,
        })
        .from(serverAllocationsTable)
        .innerJoin(
          nodeAllocationsTable,
          eq(serverAllocationsTable.allocationId, nodeAllocationsTable.id)
        )
        .where(eq(serverAllocationsTable.serverId, id))
      return c.json({
        allocations: rows,
        primaryAllocationId: access.server.primaryAllocationId,
        allocationLimit: access.server.allocationLimit,
      })
    })
    .post("/:id/allocations/random", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role === "subuser") {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "network.manage" },
        })
      }
      const [countRow] = await db
        .select({ total: count() })
        .from(serverAllocationsTable)
        .where(eq(serverAllocationsTable.serverId, id))
      const currentCount = countRow?.total ?? 0
      if (currentCount >= access.server.allocationLimit) {
        throw new ApiException("servers.allocations.limit_reached", {
          status: 409,
          params: { limit: access.server.allocationLimit },
        })
      }
      const allocation = await db.transaction(async (tx) => {
        const free = (
          await tx
            .select()
            .from(nodeAllocationsTable)
            .where(
              and(
                eq(nodeAllocationsTable.nodeId, access.server.nodeId),
                isNull(nodeAllocationsTable.serverId)
              )
            )
            .limit(1)
            .for("update")
        )[0]
        if (free === undefined) {
          throw new ApiException("servers.create.no_free_allocation", { status: 409 })
        }
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: id })
          .where(eq(nodeAllocationsTable.id, free.id))
        await tx.insert(serverAllocationsTable).values({
          serverId: id,
          allocationId: free.id,
        })
        return free
      })
      return c.json({ allocation }, 201)
    })
    .patch("/:id/allocations/:allocationId/primary", async (c) => {
      const id = c.req.param("id")
      const allocationId = c.req.param("allocationId")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role === "subuser") {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "network.manage" },
        })
      }
      const owned = await db
        .select({ allocationId: serverAllocationsTable.allocationId })
        .from(serverAllocationsTable)
        .where(
          and(
            eq(serverAllocationsTable.serverId, id),
            eq(serverAllocationsTable.allocationId, allocationId)
          )
        )
        .limit(1)
      if (owned.length === 0) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      await db
        .update(serversTable)
        .set({ primaryAllocationId: allocationId, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true })
    })
    .delete("/:id/allocations/:allocationId", async (c) => {
      const id = c.req.param("id")
      const allocationId = c.req.param("allocationId")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role === "subuser") {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "network.manage" },
        })
      }
      if (access.server.primaryAllocationId === allocationId) {
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
              eq(serverAllocationsTable.allocationId, allocationId)
            )
          )
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: null })
          .where(eq(nodeAllocationsTable.id, allocationId))
      })
      return c.json({ ok: true })
    })
}
