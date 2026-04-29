import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import { serversTable, serverAllocationsTable } from "@workspace/db/schema/servers"
import { serverTransfersTable } from "@workspace/db/schema/transfers"

import { DaemonClient } from "@/lib/DaemonClient"
import type { ServerTransferJobData } from "@/handlers/ServerTransfer.types"

const requireTransfer = async (db: Db, transferId: string) => {
  const row = (
    await db
      .select()
      .from(serverTransfersTable)
      .where(eq(serverTransfersTable.id, transferId))
      .limit(1)
  )[0]
  if (row === undefined) {
    throw new Error(`Transfer ${transferId} not found`)
  }
  return row
}

const requireNode = async (db: Db, nodeId: string) => {
  const row = (
    await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId)).limit(1)
  )[0]
  if (row === undefined) {
    throw new Error(`Node ${nodeId} not found`)
  }
  return row
}

const requireServer = async (db: Db, serverId: string) => {
  const row = (
    await db.select().from(serversTable).where(eq(serversTable.id, serverId)).limit(1)
  )[0]
  if (row === undefined) {
    throw new Error(`Server ${serverId} not found`)
  }
  return row
}

/**
 * Build the `server.transfer` job handler. Orchestrates daemon-to-daemon
 * archive streaming and flips the server's node + allocation in the DB.
 *
 * Flow:
 *   1. Stop the server on the source daemon.
 *   2. Register the one-time token with the target daemon.
 *   3. Push the archive from source to target daemon.
 *   4. Atomically flip nodeId + allocations in the DB.
 *   5. Delete server files from the source daemon.
 *   6. Mark transfer completed.
 */
export const buildServerTransferHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params

  return async (job: Job<ServerTransferJobData>) => {
    const log = logger.child({
      jobId: job.id,
      transferId: job.data.transferId,
    })

    const transfer = await requireTransfer(db, job.data.transferId)
    const server = await requireServer(db, transfer.serverId)
    const sourceNode = await requireNode(db, transfer.sourceNodeId)
    const targetNode = await requireNode(db, transfer.targetNodeId)

    await db
      .update(serverTransfersTable)
      .set({ status: "running" })
      .where(eq(serverTransfersTable.id, transfer.id))

    try {
      log.info("Stopping server before transfer")
      await daemonClient
        .request({
          nodeId: sourceNode.id,
          message: { type: "server.kill", serverId: server.id },
          timeoutMs: 60_000,
        })
        .catch((err) => log.warn({ err }, "Pre-transfer kill failed (continuing)"))

      await db
        .update(serversTable)
        .set({ status: "installing", updatedAt: new Date() })
        .where(eq(serversTable.id, server.id))

      const targetUrl = `${targetNode.scheme}://${targetNode.fqdn}:${targetNode.daemonPort}/internal/transfer/${transfer.token}`

      log.info({ targetNode: targetNode.id }, "Registering token with target daemon")
      const prepareResult = await daemonClient.request({
        nodeId: targetNode.id,
        message: {
          type: "server.prepare_transfer",
          serverId: server.id,
          token: transfer.token,
        } as never,
        timeoutMs: 30_000,
      })
      if (prepareResult.envelope.message.type === "error") {
        throw new Error(
          `Target daemon rejected prepare: ${prepareResult.envelope.message.code}`
        )
      }

      log.info({ targetUrl }, "Pushing archive from source to target daemon")
      const pushResult = await daemonClient.request({
        nodeId: sourceNode.id,
        message: {
          type: "server.push_transfer",
          serverId: server.id,
          targetUrl,
          token: transfer.token,
        } as never,
        timeoutMs: 60 * 60_000,
      })
      if (pushResult.envelope.message.type === "error") {
        throw new Error(
          `Source daemon push failed: ${pushResult.envelope.message.code}`
        )
      }

      log.info("Flipping server node + allocation in DB")
      await db.transaction(async (tx) => {
        await tx
          .update(serversTable)
          .set({
            nodeId: targetNode.id,
            primaryAllocationId: transfer.targetAllocationId,
            status: "installed_stopped",
            updatedAt: new Date(),
          })
          .where(eq(serversTable.id, server.id))

        await tx
          .delete(serverAllocationsTable)
          .where(eq(serverAllocationsTable.serverId, server.id))

        await tx.insert(serverAllocationsTable).values({
          serverId: server.id,
          allocationId: transfer.targetAllocationId,
        })

        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: null })
          .where(eq(nodeAllocationsTable.serverId, server.id))

        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: server.id })
          .where(eq(nodeAllocationsTable.id, transfer.targetAllocationId))
      })

      log.info("Deleting server files from source daemon")
      await daemonClient
        .request({
          nodeId: sourceNode.id,
          message: {
            type: "server.delete",
            serverId: server.id,
            deleteFiles: true,
          },
          timeoutMs: 5 * 60_000,
        })
        .catch((err) =>
          log.warn({ err }, "Source cleanup failed (server already moved)")
        )

      await db
        .update(serverTransfersTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(serverTransfersTable.id, transfer.id))

      log.info("Transfer complete")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error({ err }, "Transfer failed")
      await db
        .update(serverTransfersTable)
        .set({ status: "failed", error: message })
        .where(eq(serverTransfersTable.id, transfer.id))
      await db
        .update(serversTable)
        .set({ status: "installed_stopped", updatedAt: new Date() })
        .where(eq(serversTable.id, server.id))
      throw new Error(message)
    }
  }
}
