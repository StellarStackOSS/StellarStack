import type { Job } from "bullmq"
import { eq } from "drizzle-orm"
import type IORedis from "ioredis"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { nodeAllocationsTable } from "@workspace/db/schema/nodes"
import {
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { panelEventSchema } from "@workspace/shared/events"
import type {
  CreateContainerMessage,
  RunInstallScriptMessage,
} from "@workspace/daemon-proto/messages.types"

import type { Env } from "@/env"
import { DaemonClient } from "@/lib/DaemonClient"
import type { ServerInstallJobData } from "@/handlers/ServerInstall.types"

const publishProgress = async (
  redis: IORedis,
  env: Env,
  payload: {
    jobId: string
    serverId: string
    percent: number
    code: string
    params?: Record<string, string | number | boolean>
  }
): Promise<void> => {
  const event = {
    type: "job.progress" as const,
    jobId: payload.jobId,
    serverId: payload.serverId,
    jobType: "server.install",
    percent: payload.percent,
    message: { code: payload.code, ...(payload.params !== undefined ? { params: payload.params } : {}) },
    at: new Date().toISOString(),
  }
  const validated = panelEventSchema.safeParse(event)
  if (!validated.success) {
    return
  }
  await redis.publish(env.PANEL_EVENTS_CHANNEL, JSON.stringify(validated.data))
}

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

/**
 * Build the `server.install` handler. Drives the create-container →
 * run-install flow against the node's daemon over the API↔daemon bridge,
 * publishing job-progress events for the panel WS as each phase completes.
 *
 * On success the server row flips to `installed_stopped`; on failure it
 * flips to `crashed` with a translation key in the audit log so the panel
 * can display "install failed" without making up text.
 */
export const buildServerInstallHandler = (params: {
  daemonClient: DaemonClient
  db: Db
  env: Env
  logger: Logger
  pubsub: IORedis
}) => {
  const { daemonClient, db, env, logger, pubsub } = params

  return async (job: Job<ServerInstallJobData>) => {
    const log = logger.child({ jobId: job.id, serverId: job.data.serverId })
    const jobId = job.id ?? "unknown"
    log.info("Starting server install")

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

    try {
      await publishProgress(pubsub, env, {
        jobId,
        serverId: server.id,
        percent: 5,
        code: "servers.install.creating_container",
      })

      const createMessage: CreateContainerMessage = {
        type: "server.create_container",
        serverId: server.id,
        dockerImage: server.dockerImage,
        memoryLimitMb: server.memoryLimitMb,
        cpuLimitPercent: server.cpuLimitPercent,
        diskLimitMb: server.diskLimitMb,
        environment,
        portMappings: [
          {
            ip: allocation.ip,
            port: allocation.port,
            containerPort: allocation.port,
          },
        ],
        startupCommand: blueprint.startupCommand,
        stopSignal: blueprint.stopSignal,
        lifecycle: blueprint.lifecycle,
      }
      const createResult = await daemonClient.request({
        nodeId: server.nodeId,
        message: createMessage,
        timeoutMs: 5 * 60_000,
      })
      if (createResult.envelope.message.type === "error") {
        throw new Error(
          `daemon error: ${createResult.envelope.message.code}`
        )
      }

      await publishProgress(pubsub, env, {
        jobId,
        serverId: server.id,
        percent: 30,
        code: "servers.install.running_script",
      })

      const installMessage: RunInstallScriptMessage = {
        type: "server.run_install",
        serverId: server.id,
        install: {
          image: blueprint.installImage,
          entrypoint: blueprint.installEntrypoint,
          script: blueprint.installScript,
        },
        environment,
      }
      const installResult = await daemonClient.request({
        nodeId: server.nodeId,
        message: installMessage,
        timeoutMs: 30 * 60_000,
        onStream: (message) => {
          if (message.type === "server.install_log") {
            log.debug(
              { stream: message.stream, line: message.line },
              "install log"
            )
          }
        },
      })
      if (installResult.envelope.message.type === "error") {
        throw new Error(
          `daemon error: ${installResult.envelope.message.code}`
        )
      }

      await db
        .update(serversTable)
        .set({ status: "installed_stopped", updatedAt: new Date() })
        .where(eq(serversTable.id, server.id))

      await publishProgress(pubsub, env, {
        jobId,
        serverId: server.id,
        percent: 100,
        code: "servers.install.completed",
      })

      log.info("Server install completed")
    } catch (err) {
      log.error({ err }, "Server install failed")
      await db
        .update(serversTable)
        .set({ status: "crashed", updatedAt: new Date() })
        .where(eq(serversTable.id, server.id))
      await publishProgress(pubsub, env, {
        jobId,
        serverId: server.id,
        percent: 100,
        code: "servers.install.failed",
        params: { reason: err instanceof Error ? err.message : "unknown" },
      })
      throw err
    }
  }
}
