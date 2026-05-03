import { randomBytes } from "node:crypto"

import { Hono } from "hono"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import { serverTransfersTable } from "@workspace/db/schema/transfers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import { loadServerAccess } from "@/access"
import { clientIp, writeAudit } from "@/audit"
import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"
import type { Queues } from "@/queues"

const transferRequestSchema = z.object({
  targetNodeId: z.string().uuid(),
  targetAllocationId: z.string().uuid(),
})

/**
 * Server-transfer routes mounted under `/servers/:id/transfers`.
 * Only server owners and admins may initiate transfers (transfers move the
 * entire server; subusers have no business initiating that).
 */
export const buildTransfersRoute = (params: {
  auth: Auth
  db: Db
  queues: Queues
}) => {
  const { auth, db, queues } = params
  const requireSession = buildRequireSession(auth)

  const app = new Hono<{ Variables: AuthVariables }>()

  app.use("*", requireSession)

  app.get("/:serverId/transfers", async (c) => {
    const user = c.get("user")
    const { serverId } = c.req.param()
    const access = await loadServerAccess(db, user, serverId)

    if (access.role === "subuser") {
      throw new ApiException("permissions.denied", {
        status: 403,
        params: { statement: "transfers.read" },
      })
    }

    const transfers = await db
      .select()
      .from(serverTransfersTable)
      .where(eq(serverTransfersTable.serverId, serverId))
      .orderBy(desc(serverTransfersTable.createdAt))
      .limit(50)

    return c.json({ transfers })
  })

  app.post("/:serverId/transfer", async (c) => {
    const user = c.get("user")
    const { serverId } = c.req.param()
    const access = await loadServerAccess(db, user, serverId)

    if (user.isAdmin !== true) {
      throw new ApiException("permissions.denied", {
        status: 403,
        params: { statement: "admin" },
      })
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = transferRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw apiValidationError(parsed.error)
    }
    const { targetNodeId, targetAllocationId } = parsed.data

    if (targetNodeId === access.server.nodeId) {
      throw new ApiException("transfers.same_node", { status: 422 })
    }

    const targetNode = (
      await db
        .select()
        .from(nodesTable)
        .where(eq(nodesTable.id, targetNodeId))
        .limit(1)
    )[0]
    if (targetNode === undefined) {
      throw new ApiException("nodes.not_found", { status: 404 })
    }

    const allocation = (
      await db
        .select()
        .from(nodeAllocationsTable)
        .where(eq(nodeAllocationsTable.id, targetAllocationId))
        .limit(1)
    )[0]
    if (
      allocation === undefined ||
      allocation.nodeId !== targetNodeId ||
      allocation.serverId !== null
    ) {
      throw new ApiException("transfers.allocation_unavailable", {
        status: 422,
      })
    }

    const token = randomBytes(32).toString("hex")

    const rows = await db
      .insert(serverTransfersTable)
      .values({
        serverId,
        sourceNodeId: access.server.nodeId,
        targetNodeId,
        targetAllocationId,
        token,
        status: "pending",
      })
      .returning()

    const transfer = rows[0]
    if (transfer === undefined) {
      throw new ApiException("internal.unexpected", { status: 500 })
    }

    await queues.serverTransfer.add("server.transfer", {
      transferId: transfer.id,
    })

    writeAudit({
      db,
      actorId: user.id,
      ip: clientIp(c),
      action: "server.transfer",
      targetType: "server",
      targetId: serverId,
      metadata: {
        transferId: transfer.id,
        sourceNodeId: transfer.sourceNodeId,
        targetNodeId: transfer.targetNodeId,
      },
    })

    return c.json({ transfer }, 201)
  })

  return app
}
