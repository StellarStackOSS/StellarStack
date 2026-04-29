import { Worker } from "bullmq"
import { eq } from "drizzle-orm"

import { createDb } from "@workspace/db/client"
import { serversTable } from "@workspace/db/schema/servers"
import { panelEventSchema } from "@workspace/shared/events"

import { buildPingHandler } from "@/handlers/Ping"
import type { PingJobData } from "@/handlers/Ping"
import { buildServerInstallHandler } from "@/handlers/ServerInstall"
import type { ServerInstallJobData } from "@/handlers/ServerInstall.types"
import { buildServerPowerHandler } from "@/handlers/ServerPower"
import type { ServerPowerJobData } from "@/handlers/ServerPower.types"
import {
  buildBackupCreateHandler,
  buildBackupDeleteHandler,
  buildBackupRestoreHandler,
} from "@/handlers/Backups"
import type {
  BackupCreateJobData,
  BackupDeleteJobData,
  BackupRestoreJobData,
} from "@/handlers/Backups.types"
import { buildServerCommandHandler } from "@/handlers/ServerCommand"
import type { ServerCommandJobData } from "@/handlers/ServerCommand.types"
import { loadEnv } from "@/env"
import { DaemonClient } from "@/lib/DaemonClient"
import { startScheduler } from "@/lib/Scheduler"
import { createLogger } from "@/logger"
import { createPubSubRedis, createWorkerRedis } from "@/redis"

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const main = async (): Promise<void> => {
  const env = loadEnv()
  const logger = createLogger(env)
  const connection = createWorkerRedis(env)
  const pubsub = createPubSubRedis(env)
  const daemonRespSubscriber = createPubSubRedis(env)
  const stateSubscriber = createPubSubRedis(env)
  const db = createDb({ url: env.DATABASE_URL })

  const daemonClient = new DaemonClient({
    publisher: pubsub,
    subscriber: daemonRespSubscriber,
    env,
    logger,
  })
  await daemonClient.start()

  await stateSubscriber.subscribe(env.PANEL_EVENTS_CHANNEL)
  stateSubscriber.on("message", (_channel, payload) => {
    const parsed = panelEventSchema.safeParse(safeJsonParse(payload))
    if (!parsed.success) {
      return
    }
    const event = parsed.data
    if (event.type !== "server.state.changed") {
      return
    }
    db
      .update(serversTable)
      .set({ status: event.to, updatedAt: new Date() })
      .where(eq(serversTable.id, event.serverId))
      .catch((err) => {
        logger.error(
          { err, serverId: event.serverId, to: event.to },
          "failed to persist server state change"
        )
      })
  })

  const handlePing = buildPingHandler({ pubsub, env, logger })
  const handleServerInstall = buildServerInstallHandler({
    daemonClient,
    db,
    env,
    logger,
    pubsub,
  })
  const handleServerPower = buildServerPowerHandler({
    daemonClient,
    db,
    logger,
  })
  const handleBackupCreate = buildBackupCreateHandler({
    daemonClient,
    db,
    logger,
  })
  const handleBackupRestore = buildBackupRestoreHandler({
    daemonClient,
    db,
    logger,
  })
  const handleBackupDelete = buildBackupDeleteHandler({
    daemonClient,
    db,
    logger,
  })
  const handleServerCommand = buildServerCommandHandler({
    daemonClient,
    db,
    logger,
  })

  const pingWorker = new Worker<PingJobData>(
    "ping",
    async (job) => handlePing(job),
    { connection, concurrency: env.WORKER_CONCURRENCY }
  )
  pingWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Ping job failed")
  })

  const installWorker = new Worker<ServerInstallJobData>(
    "server.install",
    async (job) => handleServerInstall(job),
    { connection, concurrency: 4 }
  )
  installWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Server install job failed")
  })

  const powerWorker = new Worker<ServerPowerJobData>(
    "server.power",
    async (job) => handleServerPower(job),
    { connection, concurrency: 8 }
  )
  powerWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Server power job failed")
  })

  const backupCreateWorker = new Worker<BackupCreateJobData>(
    "backup.create",
    async (job) => handleBackupCreate(job),
    { connection, concurrency: 2 }
  )
  backupCreateWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Backup create failed")
  })

  const backupRestoreWorker = new Worker<BackupRestoreJobData>(
    "backup.restore",
    async (job) => handleBackupRestore(job),
    { connection, concurrency: 2 }
  )
  backupRestoreWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Backup restore failed")
  })

  const backupDeleteWorker = new Worker<BackupDeleteJobData>(
    "backup.delete",
    async (job) => handleBackupDelete(job),
    { connection, concurrency: 4 }
  )
  backupDeleteWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Backup delete failed")
  })

  const commandWorker = new Worker<ServerCommandJobData>(
    "server.command",
    async (job) => handleServerCommand(job),
    { connection, concurrency: 8 }
  )
  commandWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Server command failed")
  })

  const scheduler = startScheduler({ connection, db, logger })

  const handleShutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Worker shutting down")
    daemonClient.shutdown()
    scheduler.stop()
    await Promise.allSettled([
      pingWorker.close(),
      installWorker.close(),
      powerWorker.close(),
      backupCreateWorker.close(),
      backupRestoreWorker.close(),
      backupDeleteWorker.close(),
      commandWorker.close(),
      connection.quit(),
      pubsub.quit(),
      daemonRespSubscriber.quit(),
      stateSubscriber.quit(),
    ])
    process.exit(0)
  }

  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  logger.info("Worker started")
}

main().catch((err) => {
  console.error("Fatal worker startup error", err)
  process.exit(1)
})
