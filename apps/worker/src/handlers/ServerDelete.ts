import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { backupsTable } from "@workspace/db/schema/backups"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import { schedulesTable } from "@workspace/db/schema/schedules"
import {
  serverAllocationsTable,
  serversTable,
  serverSubusersTable,
  serverVariablesTable,
} from "@workspace/db/schema/servers"
import { serverTransfersTable } from "@workspace/db/schema/transfers"

import { DaemonClient } from "@/lib/DaemonClient"
import type { ServerDeleteJobData } from "@/handlers/ServerDelete.types"

/**
 * Build the `server.delete` handler.
 *
 * Order of operations:
 * 1. Load server + node from DB (fail fast if already gone).
 * 2. Send `server.kill` to daemon — stops the container immediately.
 * 3. Send `server.delete` to daemon — removes container + bind-mount files.
 * 4. Delete all child rows in DB then the server row itself.
 * 5. Release the node allocations back to the free pool.
 *
 * Daemon errors in step 2-3 are logged but do not abort the DB cleanup
 * so a crashed/unreachable node doesn't leave orphaned DB rows.
 */
export const buildServerDeleteHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params

  return async (job: Job<ServerDeleteJobData>) => {
    const { serverId } = job.data
    const log = logger.child({ jobId: job.id, serverId })
    log.info("Server delete started")

    const server = (
      await db
        .select()
        .from(serversTable)
        .where(eq(serversTable.id, serverId))
        .limit(1)
    )[0]
    if (server === undefined) {
      log.warn("Server not found — already deleted, skipping")
      return
    }

    const node = (
      await db
        .select()
        .from(nodesTable)
        .where(eq(nodesTable.id, server.nodeId))
        .limit(1)
    )[0]

    if (node !== undefined) {
      await daemonClient
        .request({
          nodeId: node.id,
          message: { type: "server.kill", serverId },
          timeoutMs: 30_000,
        })
        .catch((err) => log.warn({ err }, "Kill failed (continuing with delete)"))

      await daemonClient
        .request({
          nodeId: node.id,
          message: { type: "server.delete", serverId, deleteFiles: true },
          timeoutMs: 5 * 60_000,
        })
        .catch((err) => log.warn({ err }, "Daemon delete failed (continuing with DB cleanup)"))
    } else {
      log.warn("Node not found — skipping daemon cleanup")
    }

    await db.delete(schedulesTable).where(eq(schedulesTable.serverId, serverId))
    await db.delete(backupsTable).where(eq(backupsTable.serverId, serverId))
    await db.delete(serverTransfersTable).where(eq(serverTransfersTable.serverId, serverId))
    await db.delete(serverSubusersTable).where(eq(serverSubusersTable.serverId, serverId))
    await db.delete(serverVariablesTable).where(eq(serverVariablesTable.serverId, serverId))
    await db.delete(serverAllocationsTable).where(eq(serverAllocationsTable.serverId, serverId))
    await db
      .update(nodeAllocationsTable)
      .set({ serverId: null })
      .where(eq(nodeAllocationsTable.serverId, serverId))
    await db.delete(serversTable).where(eq(serversTable.id, serverId))

    log.info("Server delete complete")
  }
}
