import { randomBytes } from "node:crypto"

import { desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"
import { serverTransfersTable } from "@workspace/db/schema/transfers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const startSchema = z.object({
  targetNodeId: z.string().uuid(),
  targetAllocationId: z.string().uuid(),
})

/**
 * Transfer-record bookkeeping. The actual byte-pushing daemon-to-daemon
 * transfer is a phase-3 feature; this endpoint persists the request and
 * marks it `failed` with `error="not_implemented"` so the UI can
 * surface a clear message. The schema is preserved so flipping the
 * implementation switch later doesn't churn migrations.
 */
export const buildTransfersRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/transfers", async (c) => {
      const serverId = c.req.param("serverId")
      await assertOwner(db, c.get("user"), serverId)
      const rows = await db
        .select()
        .from(serverTransfersTable)
        .where(eq(serverTransfersTable.serverId, serverId))
        .orderBy(desc(serverTransfersTable.createdAt))
      return c.json({ transfers: rows })
    })
    .post("/:serverId/transfer", async (c) => {
      const serverId = c.req.param("serverId")
      const server = await assertOwner(db, c.get("user"), serverId)
      const parsed = startSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const targetNode = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, parsed.data.targetNodeId))
          .limit(1)
      )[0]
      if (targetNode === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      const targetAlloc = (
        await db
          .select()
          .from(nodeAllocationsTable)
          .where(eq(nodeAllocationsTable.id, parsed.data.targetAllocationId))
          .limit(1)
      )[0]
      if (
        targetAlloc === undefined ||
        targetAlloc.nodeId !== parsed.data.targetNodeId ||
        targetAlloc.serverId !== null
      ) {
        throw new ApiException("servers.create.allocation_unavailable", {
          status: 409,
        })
      }
      const token = randomBytes(32).toString("hex")
      const [row] = await db
        .insert(serverTransfersTable)
        .values({
          serverId,
          sourceNodeId: server.nodeId,
          targetNodeId: parsed.data.targetNodeId,
          targetAllocationId: parsed.data.targetAllocationId,
          token,
          status: "failed",
          error: "not_implemented",
        })
        .returning()
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      return c.json({ transfer: row })
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
