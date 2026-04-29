import { Worker } from "bullmq"

import { createDb } from "@workspace/db/client"

import { buildPingHandler } from "@/handlers/Ping"
import type { PingJobData } from "@/handlers/Ping"
import { buildServerInstallHandler } from "@/handlers/ServerInstall"
import type { ServerInstallJobData } from "@/handlers/ServerInstall.types"
import { loadEnv } from "@/env"
import { DaemonClient } from "@/lib/DaemonClient"
import { createLogger } from "@/logger"
import { createPubSubRedis, createWorkerRedis } from "@/redis"

const main = async (): Promise<void> => {
  const env = loadEnv()
  const logger = createLogger(env)
  const connection = createWorkerRedis(env)
  const pubsub = createPubSubRedis(env)
  const daemonRespSubscriber = createPubSubRedis(env)
  const db = createDb({ url: env.DATABASE_URL })

  const daemonClient = new DaemonClient({
    publisher: pubsub,
    subscriber: daemonRespSubscriber,
    env,
    logger,
  })
  await daemonClient.start()

  const handlePing = buildPingHandler({ pubsub, env, logger })
  const handleServerInstall = buildServerInstallHandler({
    daemonClient,
    db,
    env,
    logger,
    pubsub,
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

  const handleShutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Worker shutting down")
    daemonClient.shutdown()
    await Promise.allSettled([
      pingWorker.close(),
      installWorker.close(),
      connection.quit(),
      pubsub.quit(),
      daemonRespSubscriber.quit(),
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
