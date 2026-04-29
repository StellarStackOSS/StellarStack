import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { serversTable } from "@workspace/db/schema/servers"
import type { DaemonMessage } from "@workspace/daemon-proto/messages.types"

import { DaemonClient } from "@/lib/DaemonClient"
import type { ServerPowerJobData } from "@/handlers/ServerPower.types"

const messageFor = (
  serverId: string,
  action: ServerPowerJobData["action"]
): DaemonMessage => {
  switch (action) {
    case "start":
      return { type: "server.start", serverId }
    case "stop":
    case "restart":
      return { type: "server.stop", serverId }
    case "kill":
      return { type: "server.kill", serverId }
  }
}

/**
 * Build the `server.power` handler. Pure dispatch: looks up the server's
 * node, sends the matching daemon message via the bridge, awaits ack.
 * Lifecycle state changes that follow (starting → running etc.) are
 * driven by the daemon's lifecycle Watcher and arrive as separate
 * `server.state_changed` frames on the panel-event channel.
 */
export const buildServerPowerHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  logger: Logger
}) => {
  const { daemonClient, db, logger } = params

  return async (job: Job<ServerPowerJobData>) => {
    const log = logger.child({
      jobId: job.id,
      serverId: job.data.serverId,
      action: job.data.action,
    })
    log.info("Power action")

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
      message: messageFor(server.id, job.data.action),
      timeoutMs: 60_000,
    })
    if (result.envelope.message.type === "error") {
      throw new Error(`daemon error: ${result.envelope.message.code}`)
    }

    if (job.data.action === "restart") {
      const startResult = await daemonClient.request({
        nodeId: server.nodeId,
        message: { type: "server.start", serverId: server.id },
        timeoutMs: 60_000,
      })
      if (startResult.envelope.message.type === "error") {
        throw new Error(
          `daemon error during restart-start: ${startResult.envelope.message.code}`
        )
      }
    }
    log.info("Power action complete")
  }
}
