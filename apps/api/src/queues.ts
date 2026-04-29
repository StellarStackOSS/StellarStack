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
 * Payload shape for the `server.install` queue. The worker uses this to
 * orchestrate create-container + run-install against the node's daemon.
 */
export type ServerInstallJobData = {
  serverId: string
}

/**
 * Payload shape for the `server.power` queue (start / stop / restart / kill).
 */
export type ServerPowerJobData = {
  serverId: string
  action: "start" | "stop" | "restart" | "kill"
}

/**
 * Payload shape for the `backup.create` queue.
 */
export type BackupCreateJobData = {
  backupId: string
}

/**
 * Payload shape for the `backup.restore` queue.
 */
export type BackupRestoreJobData = {
  backupId: string
}

/**
 * Payload shape for the `backup.delete` queue.
 */
export type BackupDeleteJobData = {
  backupId: string
}

/**
 * Payload shape for the `server.command` queue. The worker pushes the
 * console line over the daemon WS once it dequeues the job.
 */
export type ServerCommandJobData = {
  serverId: string
  line: string
}

/**
 * Aggregate of all BullMQ producers the API holds open.
 */
export type Queues = {
  ping: Queue<{ message: string }>
  serverInstall: Queue<ServerInstallJobData>
  serverPower: Queue<ServerPowerJobData>
  serverCommand: Queue<ServerCommandJobData>
  backupCreate: Queue<BackupCreateJobData>
  backupRestore: Queue<BackupRestoreJobData>
  backupDelete: Queue<BackupDeleteJobData>
}

/**
 * Build BullMQ producer queues. The names here must match the consumer
 * `Worker(name, ...)` constructors in `apps/worker`.
 */
export const createQueues = (connection: IORedis): Queues => ({
  ping: new Queue("ping", { connection }),
  serverInstall: new Queue("server.install", { connection }),
  serverPower: new Queue("server.power", { connection }),
  serverCommand: new Queue("server.command", { connection }),
  backupCreate: new Queue("backup.create", { connection }),
  backupRestore: new Queue("backup.restore", { connection }),
  backupDelete: new Queue("backup.delete", { connection }),
})
