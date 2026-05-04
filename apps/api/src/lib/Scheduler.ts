import { and, asc, eq, lte } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import {
  scheduleTasksTable,
  schedulesTable,
} from "@workspace/db/schema/schedules"
import { serversTable } from "@workspace/db/schema/servers"

import type { StatusCache } from "@/lib/StatusCache"
import { callDaemon } from "@/lib/DaemonHttp"

const TICK_MS = 30_000

/**
 * Compute the next firing time for a cron expression. We support a
 * deliberately small subset (`*`, single value, comma-list) on the
 * 5-field schedule (m h dom mon dow) — full vixie cron requires a parser
 * we don't want to maintain. If the expression is unsupported, the
 * scheduler treats the schedule as "never" so it doesn't crash-loop on
 * bad input.
 */
const nextFiring = (expr: string, after: Date): Date | null => {
  const fields = expr.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const [mField, hField, domField, monField, dowField] = fields
  const matches = (field: string | undefined, value: number): boolean => {
    if (field === undefined || field === "*") return true
    return field
      .split(",")
      .some((part) => Number.parseInt(part, 10) === value)
  }
  // Search forward minute-by-minute for up to a year. This is wasteful
  // for very-rarely-firing schedules but bounded; production-grade we'd
  // pull `cron-parser`, but we don't want the dep just for this.
  const cur = new Date(Math.ceil(after.getTime() / 60_000) * 60_000)
  for (let i = 0; i < 60 * 24 * 366; i++) {
    if (
      matches(mField, cur.getUTCMinutes()) &&
      matches(hField, cur.getUTCHours()) &&
      matches(domField, cur.getUTCDate()) &&
      matches(monField, cur.getUTCMonth() + 1) &&
      matches(dowField, cur.getUTCDay())
    ) {
      return cur
    }
    cur.setUTCMinutes(cur.getUTCMinutes() + 1)
  }
  return null
}

/**
 * Run scheduled tasks against connected daemons. One scheduler per API
 * process; the tick is short and cheap (a single SELECT) so there's no
 * coordination needed between API replicas — at most you'll get a
 * duplicate task in a multi-replica deploy, which is acceptable for the
 * power/command/backup actions we support.
 */
export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | null = null

  public constructor(
    private readonly db: Db,
    private readonly statusCache: StatusCache
  ) {}

  public start(): void {
    if (this.timer !== null) return
    this.tick()
  }

  public stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private tick(): void {
    void this.runDue().finally(() => {
      this.timer = setTimeout(() => this.tick(), TICK_MS)
    })
  }

  private async runDue(): Promise<void> {
    const now = new Date()
    const due = await this.db
      .select()
      .from(schedulesTable)
      .where(
        and(
          eq(schedulesTable.enabled, true),
          lte(schedulesTable.nextRunAt, now)
        )
      )
    for (const schedule of due) {
      // Snapshot run + immediately reschedule so the next tick doesn't
      // double-fire the same schedule on a slow run.
      const next = nextFiring(schedule.cron, now)
      await this.db
        .update(schedulesTable)
        .set({
          lastRunAt: now,
          nextRunAt: next,
        })
        .where(eq(schedulesTable.id, schedule.id))
      void this.runSchedule(schedule.id, schedule.serverId, schedule.onlyWhenOnline)
    }
    // Bootstrap nextRunAt for newly-enabled schedules with null nextRunAt.
    const fresh = await this.db
      .select()
      .from(schedulesTable)
      .where(
        and(
          eq(schedulesTable.enabled, true)
        )
      )
    for (const s of fresh) {
      if (s.nextRunAt !== null) continue
      const next = nextFiring(s.cron, now)
      if (next === null) continue
      await this.db
        .update(schedulesTable)
        .set({ nextRunAt: next })
        .where(eq(schedulesTable.id, s.id))
    }
  }

  private async runSchedule(
    scheduleId: string,
    serverId: string,
    onlyWhenOnline: boolean
  ): Promise<void> {
    if (onlyWhenOnline) {
      const status = await this.statusCache.get(serverId)
      if (status !== "running") return
    }
    const tasks = await this.db
      .select()
      .from(scheduleTasksTable)
      .where(eq(scheduleTasksTable.scheduleId, scheduleId))
      .orderBy(asc(scheduleTasksTable.sortOrder))
    if (tasks.length === 0) return

    const server = (
      await this.db
        .select({ row: serversTable, node: nodesTable })
        .from(serversTable)
        .innerJoin(nodesTable, eq(nodesTable.id, serversTable.nodeId))
        .where(eq(serversTable.id, serverId))
        .limit(1)
    )[0]
    if (server === undefined) return
    if (server.node.daemonPublicKey === null) return
    const baseUrl = `${server.node.scheme}://${server.node.fqdn}:${server.node.daemonPort}`

    for (const task of tasks) {
      if (task.delaySeconds > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, task.delaySeconds * 1000)
        )
      }
      try {
        await this.runTask(
          baseUrl,
          server.node.id,
          server.node.daemonPublicKey,
          serverId,
          task
        )
      } catch (err) {
        console.error(`schedule task ${task.id} failed:`, err)
      }
    }
  }

  private async runTask(
    baseUrl: string,
    nodeId: string,
    signingKeyHex: string,
    serverId: string,
    task: typeof scheduleTasksTable.$inferSelect
  ): Promise<void> {
    const payload = task.payload ?? {}
    switch (task.action) {
      case "power": {
        const action = String(payload["action"] ?? "")
        if (
          action !== "start" &&
          action !== "stop" &&
          action !== "restart" &&
          action !== "kill"
        ) {
          return
        }
        await callDaemon({
          baseUrl,
          nodeId,
          signingKeyHex,
          method: "POST",
          path: `/api/servers/${serverId}/power`,
          body: { action },
        })
        return
      }
      case "command": {
        const line = String(payload["line"] ?? "")
        if (line === "") return
        await callDaemon({
          baseUrl,
          nodeId,
          signingKeyHex,
          method: "POST",
          path: `/api/servers/${serverId}/command`,
          body: { line },
        })
        return
      }
      case "backup": {
        // Backups need a DB row + the API's backup orchestration; not
        // wireable from the scheduler without lifting that helper out.
        // Phase-5 work — log and continue so other tasks still fire.
        console.warn("schedule task: backup action not yet wired", task.id)
        return
      }
    }
  }
}
