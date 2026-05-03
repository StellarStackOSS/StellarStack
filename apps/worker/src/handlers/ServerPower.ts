import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { nodeAllocationsTable } from "@workspace/db/schema/nodes"
import {
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import type { ConfigFilePatch, DaemonMessage } from "@workspace/daemon-proto/messages.types"

import { DaemonClient } from "@/lib/DaemonClient"
import type { ServerPowerJobData } from "@/handlers/ServerPower.types"

const buildEnvironment = (
  variables: Record<string, string>,
  allocation: { ip: string; port: number },
  memoryMb: number
): Record<string, string> => ({
  ...variables,
  SERVER_PORT: String(allocation.port),
  SERVER_IP: allocation.ip,
  SERVER_MEMORY: String(memoryMb),
})

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

    const buildStartMessage = async (): Promise<DaemonMessage> => {
      const blueprint = (
        await db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, server.blueprintId))
          .limit(1)
      )[0]
      if (blueprint === undefined) {
        throw new Error(`Blueprint ${server.blueprintId} not found`)
      }
      if (server.primaryAllocationId === null) {
        throw new Error(`Server ${server.id} has no primary allocation`)
      }
      const allocation = (
        await db
          .select()
          .from(nodeAllocationsTable)
          .where(eq(nodeAllocationsTable.id, server.primaryAllocationId))
          .limit(1)
      )[0]
      if (allocation === undefined) {
        throw new Error("Allocation not found for server")
      }

      const variableRows = await db
        .select()
        .from(serverVariablesTable)
        .where(eq(serverVariablesTable.serverId, server.id))
      const variables: Record<string, string> = {}
      for (const row of variableRows) {
        variables[row.variableKey] = row.value
      }
      const environment = buildEnvironment(
        variables,
        { ip: allocation.ip, port: allocation.port },
        server.memoryLimitMb
      )

      return {
        type: "server.start",
        serverId: server.id,
        container: {
          dockerImage: server.dockerImage,
          memoryLimitMb: server.memoryLimitMb,
          cpuLimitPercent: server.cpuLimitPercent,
          processLimit: 256,
          diskLimitMb: server.diskLimitMb,
          environment,
          portMappings: [
            {
              ip: allocation.ip,
              port: allocation.port,
              containerPort: allocation.port,
            },
          ],
          startupCommand: server.startupExtra
            ? `${blueprint.startupCommand} ${server.startupExtra}`
            : blueprint.startupCommand,
          stopSignal: blueprint.stopSignal,
          lifecycle: blueprint.lifecycle,
          features: (blueprint.features as unknown as Record<string, string[]>) ?? {},
          configFiles: (blueprint.configFiles as ConfigFilePatch[]) ?? [],
        },
      }
    }

    const buildStopMessage = async (): Promise<DaemonMessage> => {
      const blueprint = (
        await db
          .select({ stopSignal: blueprintsTable.stopSignal })
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, server.blueprintId))
          .limit(1)
      )[0]
      return {
        type: "server.stop",
        serverId: server.id,
        stopSignal: blueprint?.stopSignal ?? "",
      }
    }

    const messageFor = async (
      action: ServerPowerJobData["action"]
    ): Promise<DaemonMessage> => {
      switch (action) {
        case "start":
          return buildStartMessage()
        case "stop":
        case "restart":
          return buildStopMessage()
        case "kill":
          return { type: "server.kill", serverId: server.id }
      }
    }

    const action = job.data.action

    if (action === "start") {
      // Start must await the daemon ACK so we know the container launched.
      const result = await daemonClient.request({
        nodeId: server.nodeId,
        message: await buildStartMessage(),
        timeoutMs: 60_000,
      })
      if (result.envelope.message.type === "error") {
        throw new Error(`daemon error: ${result.envelope.message.code}`)
      }
    } else if (action === "restart") {
      // Stop first (fire-and-forget — daemon pushes state changes), then start.
      void daemonClient
        .request({ nodeId: server.nodeId, message: await buildStopMessage(), timeoutMs: 30_000 })
        .catch((err: unknown) => log.warn({ err }, "restart stop phase error"))

      // Brief delay to let the daemon begin the stop before we fire the start.
      await new Promise<void>((resolve) => setTimeout(resolve, 2_000))

      const startResult = await daemonClient.request({
        nodeId: server.nodeId,
        message: await buildStartMessage(),
        timeoutMs: 60_000,
      })
      if (startResult.envelope.message.type === "error") {
        throw new Error(`daemon error during restart-start: ${startResult.envelope.message.code}`)
      }
    } else {
      // stop / kill: fire-and-forget — the daemon emits server.state.changed push
      // events as the container transitions, so the UI updates via WebSocket without
      // the worker needing to block on the full container shutdown.
      void daemonClient
        .request({
          nodeId: server.nodeId,
          message: await messageFor(action),
          timeoutMs: 30_000,
        })
        .catch((err: unknown) => log.warn({ err }, `${action} daemon error`))
    }

    log.info("Power action dispatched")
  }
}
