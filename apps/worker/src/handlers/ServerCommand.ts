import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { serversTable } from "@workspace/db/schema/servers"

import { DaemonClient } from "@/lib/DaemonClient"
import type { ServerCommandJobData } from "@/handlers/ServerCommand.types"

/**
 * Build the `server.command` handler. Looks up the server's node and
 * sends a one-shot `server.send_console` to the daemon. Used by the
 * scheduler tick for cron-driven console commands; the live console WS
 * still writes directly without going through this queue.
 */
export const buildServerCommandHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params

  return async (job: Job<ServerCommandJobData>) => {
    const log = logger.child({
      jobId: job.id,
      serverId: job.data.serverId,
    })
    const server = (
      await db
        .select()
        .from(serversTable)
        .where(eq(serversTable.id, job.data.serverId))
        .limit(1)
    )[0]
    if (server === undefined) {
      throw new Error(`Server ${job.data.serverId} not found`)
    }
    const result = await daemonClient.request({
      nodeId: server.nodeId,
      message: {
        type: "server.send_console",
        serverId: server.id,
        line: job.data.line,
      },
      timeoutMs: 30_000,
    })
    if (result.envelope.message.type === "error") {
      throw new Error(`daemon error: ${result.envelope.message.code}`)
    }
    log.info("Console command delivered")
  }
}
