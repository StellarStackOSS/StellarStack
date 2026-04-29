import { serve } from "@hono/node-server"

import { createDb } from "@workspace/db/client"

import { createApp } from "@/app"
import { createAuth } from "@/auth"
import { loadEnv } from "@/env"
import { createLogger } from "@/logger"
import { createQueues, createRedis } from "@/queues"

const main = async (): Promise<void> => {
  const env = loadEnv()
  const logger = createLogger(env)
  const db = createDb({ url: env.DATABASE_URL })
  const redis = createRedis(env)
  const queues = createQueues(redis)
  const auth = createAuth(db, env)
  const app = createApp({ auth, db, redis, logger })

  const handleShutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down")
    await Promise.allSettled([
      queues.ping.close(),
      redis.quit(),
    ])
    process.exit(0)
  }

  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
    logger.info({ host: info.address, port: info.port }, "API listening")
  })
}

main().catch((err) => {
  console.error("Fatal startup error", err)
  process.exit(1)
})
