import IORedis from "ioredis"
import { Queue } from "bullmq"

import type { Env } from "@/env"

/**
 * Build the shared `ioredis` connection used by BullMQ producers. BullMQ
 * requires `maxRetriesPerRequest: null` for blocking commands.
 */
export const createRedis = (env: Env): IORedis => {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

/**
 * Aggregate of all BullMQ producers the API holds open. The worker side has
 * a corresponding consumer for each queue name.
 */
export type Queues = {
  ping: Queue<{ message: string }>
}

/**
 * Build BullMQ producer queues. The `ping` queue is a smoke-test target used
 * during the foundation milestone; real queues (server.install, backup, etc.)
 * are added alongside their feature work.
 */
export const createQueues = (connection: IORedis): Queues => ({
  ping: new Queue<{ message: string }>("ping", { connection }),
})
