import IORedis from "ioredis"

import type { Env } from "@/env"

/**
 * Build the BullMQ connection. `maxRetriesPerRequest: null` is required for
 * blocking commands used by workers.
 */
export const createWorkerRedis = (env: Env): IORedis =>
  new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

/**
 * Build a separate connection used only for pub/sub. Pub/sub clients can't
 * issue arbitrary commands once subscribed, so they must not be shared with
 * the BullMQ blocking-command client.
 */
export const createPubSubRedis = (env: Env): IORedis =>
  new IORedis(env.REDIS_URL)
