import type { Job } from "bullmq"
import type IORedis from "ioredis"
import type { Logger } from "pino"

import { panelEventSchema } from "@workspace/shared/events"
import type { PanelEvent } from "@workspace/shared/events.types"

import type { Env } from "@/env"

/**
 * Payload shape for the `ping` queue. Mirrors the producer-side type in
 * `apps/api/src/queues.ts`.
 */
export type PingJobData = {
  message: string
}

/**
 * Smoke-test job handler. Logs the message and publishes a `job.progress`
 * panel event so the api → BullMQ → worker → Redis pub/sub → web fanout
 * pipeline can be exercised end to end before any real server exists.
 *
 * Every event is validated against `panelEventSchema` before publish — even
 * trusted producers go through the wire schema so a programming error
 * can't pollute the channel with a malformed frame that would later be
 * dropped by every subscribed API instance.
 */
export const buildPingHandler = (params: {
  pubsub: IORedis
  env: Env
  logger: Logger
}) => {
  const { pubsub, env, logger } = params
  return async (job: Job<PingJobData>) => {
    logger.info({ jobId: job.id, data: job.data }, "Handling ping job")

    const event: PanelEvent = {
      type: "job.progress",
      jobId: job.id ?? "unknown",
      jobType: "ping",
      percent: 100,
      message: { code: "internal.ping", params: { text: job.data.message } },
      at: new Date().toISOString(),
    }

    const validated = panelEventSchema.safeParse(event)
    if (!validated.success) {
      logger.error(
        { issues: validated.error.issues, event },
        "Refusing to publish malformed panel event"
      )
      return
    }

    await pubsub.publish(
      env.PANEL_EVENTS_CHANNEL,
      JSON.stringify(validated.data)
    )
  }
}
