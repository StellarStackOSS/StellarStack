import { Worker } from "bullmq"

import { buildPingHandler } from "@/handlers/Ping"
import type { PingJobData } from "@/handlers/Ping"
import { loadEnv } from "@/env"
import { createLogger } from "@/logger"
import { createPubSubRedis, createWorkerRedis } from "@/redis"

const main = async (): Promise<void> => {
  const env = loadEnv()
  const logger = createLogger(env)
  const connection = createWorkerRedis(env)
  const pubsub = createPubSubRedis(env)

  const handlePing = buildPingHandler({ pubsub, env, logger })

  const pingWorker = new Worker<PingJobData>(
    "ping",
    async (job) => handlePing(job),
    { connection, concurrency: env.WORKER_CONCURRENCY }
  )

  pingWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Ping job failed")
  })

  const handleShutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Worker shutting down")
    await Promise.allSettled([
      pingWorker.close(),
      connection.quit(),
      pubsub.quit(),
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
