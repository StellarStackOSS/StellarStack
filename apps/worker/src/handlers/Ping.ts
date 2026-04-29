import type { Job } from "bullmq"
import type IORedis from "ioredis"
import type { Logger } from "pino"

import type { Env } from "@/env"

/**
 * Payload shape for the `ping` queue. Mirrors the producer-side type in
 * `apps/api/src/queues.ts`.
 */
export type PingJobData = {
  message: string
}

/**
 * Smoke-test job handler. Logs the message and publishes a panel event so
 * the API → web fanout pipeline can be exercised end to end without a real
 * server present yet.
 */
export const buildPingHandler = (params: {
  pubsub: IORedis
  env: Env
  logger: Logger
}) => {
  const { pubsub, env, logger } = params
  return async (job: Job<PingJobData>) => {
    logger.info({ jobId: job.id, data: job.data }, "Handling ping job")
    await pubsub.publish(
      env.PANEL_EVENTS_CHANNEL,
      JSON.stringify({
        type: "job.progress",
        jobId: job.id ?? "unknown",
        jobType: "ping",
        percent: 100,
        message: { code: "internal.ping", params: { text: job.data.message } },
        at: new Date().toISOString(),
      })
    )
  }
}
