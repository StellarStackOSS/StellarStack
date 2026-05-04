import { createHmac } from "node:crypto"

import { desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { serverTransfersTable } from "@workspace/db/schema/transfers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { writeAudit } from "@/lib/Audit"
import { callDaemon } from "@/lib/DaemonHttp"
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
      // Mint the one-time HMAC token the source daemon will present to
      // the target. Signed with the *target* node's key — only the
      // target can verify, only the source can present.
      if (targetNode.daemonPublicKey === null) {
        throw new ApiException("nodes.unreachable", { status: 503 })
      }
      const sourceNode = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, server.nodeId))
          .limit(1)
      )[0]
      if (sourceNode === undefined || sourceNode.daemonPublicKey === null) {
        throw new ApiException("nodes.unreachable", { status: 503 })
      }
      const ts = Math.floor(Date.now() / 1000)
      const token = createHmac(
        "sha256",
        Buffer.from(targetNode.daemonPublicKey, "hex")
      )
        .update(`${serverId}|${ts}`)
        .digest("hex")

      const [row] = await db
        .insert(serverTransfersTable)
        .values({
          serverId,
          sourceNodeId: server.nodeId,
          targetNodeId: parsed.data.targetNodeId,
          targetAllocationId: parsed.data.targetAllocationId,
          token,
          status: "running",
        })
        .returning()
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }

      // Kick the source daemon to push to the target. Async so the
      // response returns quickly; the row's `status` flips to completed
      // / failed inline below once the source's call returns.
      const targetUrl = `${targetNode.scheme}://${targetNode.fqdn}:${targetNode.daemonPort}/api/servers/${serverId}/transfer/ingest`
      const pushBody = { targetUrl, token, timestamp: ts }
      void (async () => {
        try {
          const resp = await callDaemon({
            baseUrl: `${sourceNode.scheme}://${sourceNode.fqdn}:${sourceNode.daemonPort}`,
            nodeId: sourceNode.id,
            signingKeyHex: sourceNode.daemonPublicKey ?? "",
            method: "POST",
            path: `/api/servers/${serverId}/transfer/push`,
            body: pushBody,
          })
          if (!resp.ok) {
            await db
              .update(serverTransfersTable)
              .set({
                status: "failed",
                error: `source push: ${resp.status}`,
                completedAt: new Date(),
              })
              .where(eq(serverTransfersTable.id, row.id))
            return
          }
          // Atomic switchover: free the old primary allocation, link
          // the new one, retarget the server's nodeId.
          await db.transaction(async (tx) => {
            const oldAllocId = server.primaryAllocationId
            await tx
              .update(nodeAllocationsTable)
              .set({ serverId: null })
              .where(eq(nodeAllocationsTable.serverId, serverId))
            await tx
              .delete(serverAllocationsTable)
              .where(eq(serverAllocationsTable.serverId, serverId))
            await tx
              .update(nodeAllocationsTable)
              .set({ serverId })
              .where(
                eq(
                  nodeAllocationsTable.id,
                  parsed.data.targetAllocationId
                )
              )
            await tx.insert(serverAllocationsTable).values({
              serverId,
              allocationId: parsed.data.targetAllocationId,
            })
            await tx
              .update(serversTable)
              .set({
                nodeId: parsed.data.targetNodeId,
                primaryAllocationId: parsed.data.targetAllocationId,
                status: "offline",
                updatedAt: new Date(),
              })
              .where(eq(serversTable.id, serverId))
            await tx
              .update(serverTransfersTable)
              .set({ status: "completed", completedAt: new Date() })
              .where(eq(serverTransfersTable.id, row.id))
            void oldAllocId // explicit unused binding for clarity
          })
          void writeAudit({
            db,
            actorId: null,
            action: "servers.transferred",
            targetType: "server",
            targetId: serverId,
            metadata: {
              sourceNode: sourceNode.id,
              targetNode: parsed.data.targetNodeId,
            },
          })
        } catch (err) {
          await db
            .update(serverTransfersTable)
            .set({
              status: "failed",
              error: err instanceof Error ? err.message : "unknown",
              completedAt: new Date(),
            })
            .where(eq(serverTransfersTable.id, row.id))
        }
      })()
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
