import { Queue } from "bullmq"
import type IORedis from "ioredis"
import { CronExpressionParser } from "cron-parser"
import { and, eq, lte } from "drizzle-orm"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"
import { backupsTable } from "@workspace/db/schema/backups"
import {
  scheduleTasksTable,
  schedulesTable,
  type ScheduleRow,
  type ScheduleTaskRow,
} from "@workspace/db/schema/schedules"
import { serversTable } from "@workspace/db/schema/servers"

import type { BackupCreateJobData } from "@/handlers/Backups.types"
import type { ServerCommandJobData } from "@/handlers/ServerCommand.types"
import type { ServerPowerJobData } from "@/handlers/ServerPower.types"
import type {
  ScheduleBackupPayload,
  ScheduleCommandPayload,
  SchedulePowerPayload,
} from "@/lib/Scheduler.types"

const TICK_INTERVAL_MS = 30_000

const isPowerAction = (
  v: unknown
): v is SchedulePowerPayload["action"] =>
  v === "start" || v === "stop" || v === "restart" || v === "kill"

const advanceCron = (cron: string, after: Date): Date | null => {
  try {
    const it = CronExpressionParser.parse(cron, {
      tz: "UTC",
      currentDate: after,
    })
    return it.next().toDate()
  } catch {
    return null
  }
}

/**
 * Cron-tick scheduler. Polls `schedules` for rows whose `next_run_at` is
 * past-due, advances `next_run_at` from the cron expression, and fans out
 * the schedule's ordered tasks onto the matching queues with each task's
 * `delaySeconds` honoured by BullMQ's `delay` option.
 *
 * Honours `onlyWhenOnline` by skipping fires whose server is not in
 * `running`. Failure to dispatch one task does not stop later tasks; the
 * tick advances `next_run_at` regardless so a wedged daemon can't block
 * the schedule forever.
 */
export const startScheduler = (params: {
  connection: IORedis
  db: Db
  logger: Logger
}): { stop: () => void } => {
  const { connection, db, logger } = params

  const powerQueue = new Queue<ServerPowerJobData>("server.power", {
    connection,
  })
  const commandQueue = new Queue<ServerCommandJobData>("server.command", {
    connection,
  })
  const backupQueue = new Queue<BackupCreateJobData>("backup.create", {
    connection,
  })

  let timer: NodeJS.Timeout | null = null
  let running = false

  const tick = async (): Promise<void> => {
    if (running) return
    running = true
    try {
      const now = new Date()
      const due = await db
        .select()
        .from(schedulesTable)
        .where(
          and(
            eq(schedulesTable.enabled, true),
            lte(schedulesTable.nextRunAt, now)
          )
        )
      for (const schedule of due) {
        await fireSchedule({
          db,
          schedule,
          powerQueue,
          commandQueue,
          backupQueue,
          logger,
          now,
        })
      }
    } catch (err) {
      logger.error({ err }, "Scheduler tick failed")
    } finally {
      running = false
    }
  }

  void tick()
  timer = setInterval(() => {
    void tick()
  }, TICK_INTERVAL_MS)

  return {
    stop: () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      void powerQueue.close()
      void commandQueue.close()
      void backupQueue.close()
    },
  }
}

const fireSchedule = async (params: {
  db: Db
  schedule: ScheduleRow
  powerQueue: Queue<ServerPowerJobData>
  commandQueue: Queue<ServerCommandJobData>
  backupQueue: Queue<BackupCreateJobData>
  logger: Logger
  now: Date
}): Promise<void> => {
  const { db, schedule, powerQueue, commandQueue, backupQueue, logger, now } =
    params

  const next = advanceCron(schedule.cron, now)
  await db
    .update(schedulesTable)
    .set({ lastRunAt: now, nextRunAt: next })
    .where(eq(schedulesTable.id, schedule.id))

  if (schedule.onlyWhenOnline) {
    const server = (
      await db
        .select({ status: serversTable.status })
        .from(serversTable)
        .where(eq(serversTable.id, schedule.serverId))
        .limit(1)
    )[0]
    if (server === undefined || server.status !== "running") {
      logger.info(
        { scheduleId: schedule.id, serverId: schedule.serverId },
        "skipping schedule fire (server not online)"
      )
      return
    }
  }

  const tasks = await db
    .select()
    .from(scheduleTasksTable)
    .where(eq(scheduleTasksTable.scheduleId, schedule.id))
  tasks.sort((a, b) => a.sortOrder - b.sortOrder)

  for (const task of tasks) {
    try {
      await dispatchTask({
        db,
        task,
        serverId: schedule.serverId,
        powerQueue,
        commandQueue,
        backupQueue,
      })
    } catch (err) {
      logger.error(
        { err, scheduleId: schedule.id, taskId: task.id },
        "Failed to dispatch scheduled task"
      )
    }
  }
}

const dispatchTask = async (params: {
  db: Db
  task: ScheduleTaskRow
  serverId: string
  powerQueue: Queue<ServerPowerJobData>
  commandQueue: Queue<ServerCommandJobData>
  backupQueue: Queue<BackupCreateJobData>
}): Promise<void> => {
  const { db, task, serverId, powerQueue, commandQueue, backupQueue } = params
  const delay = Math.max(0, task.delaySeconds) * 1000
  const payload = task.payload ?? {}

  switch (task.action) {
    case "power": {
      const action = (payload as SchedulePowerPayload).action
      if (!isPowerAction(action)) {
        throw new Error(`scheduled power task ${task.id} missing action`)
      }
      await powerQueue.add(
        "power",
        { serverId, action },
        {
          delay,
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      )
      return
    }
    case "command": {
      const line = (payload as ScheduleCommandPayload).line
      if (typeof line !== "string" || line.length === 0) {
        throw new Error(`scheduled command task ${task.id} missing line`)
      }
      await commandQueue.add(
        "command",
        { serverId, line },
        {
          delay,
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      )
      return
    }
    case "backup": {
      const name =
        (payload as ScheduleBackupPayload).name ??
        `scheduled-${new Date().toISOString().replace(/[:.]/g, "-")}`
      const inserted = await db
        .insert(backupsTable)
        .values({ serverId, name, storage: "local", state: "pending" })
        .returning({ id: backupsTable.id })
      const row = inserted[0]
      if (row === undefined) {
        throw new Error(`failed to insert backup row for task ${task.id}`)
      }
      await backupQueue.add(
        "create",
        { backupId: row.id },
        { delay, removeOnComplete: 100, removeOnFail: 100 }
      )
      return
    }
  }
}
