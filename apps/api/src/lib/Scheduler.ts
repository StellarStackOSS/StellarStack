import { and, asc, eq, lte } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import {
  scheduleTasksTable,
  schedulesTable,
} from "@workspace/db/schema/schedules"
import { serversTable } from "@workspace/db/schema/servers"

import { runBackup } from "@/lib/BackupRunner"
import { callDaemon } from "@/lib/DaemonHttp"
import type { StatusCache } from "@/lib/StatusCache"

type ScheduleTaskRow = (typeof scheduleTasksTable)["$inferSelect"]

const TICK_MS = 30_000

type FieldRange = { min: number; max: number }

const RANGES: Record<"m" | "h" | "dom" | "mon" | "dow", FieldRange> = {
  m: { min: 0, max: 59 },
  h: { min: 0, max: 23 },
  dom: { min: 1, max: 31 },
  mon: { min: 1, max: 12 },
  dow: { min: 0, max: 6 },
}

// Parse one cron field into the explicit set of values it permits.
// Supports * comma-lists a-b ranges and step expressions of form base/N.
// Returns null if the field is malformed.
const parseField = (
  field: string,
  range: FieldRange
): Set<number> | null => {
  const out = new Set<number>()
  for (const part of field.split(",")) {
    const stepMatch = /^(.+?)\/(\d+)$/.exec(part)
    let base = part
    let step = 1
    if (stepMatch !== null) {
      base = stepMatch[1] ?? "*"
      step = Number.parseInt(stepMatch[2] ?? "1", 10)
      if (Number.isNaN(step) || step <= 0) return null
    }
    let lo = range.min
    let hi = range.max
    if (base !== "*") {
      const rangeMatch = /^(\d+)-(\d+)$/.exec(base)
      if (rangeMatch !== null) {
        lo = Number.parseInt(rangeMatch[1] ?? "", 10)
        hi = Number.parseInt(rangeMatch[2] ?? "", 10)
      } else {
        const single = Number.parseInt(base, 10)
        if (Number.isNaN(single)) return null
        lo = single
        hi = single
      }
    }
    if (
      Number.isNaN(lo) ||
      Number.isNaN(hi) ||
      lo < range.min ||
      hi > range.max ||
      lo > hi
    ) {
      return null
    }
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return out
}

const NAMED: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
}

// Compute the next firing time for a cron expression. Supports * lists
// 1,5,10 ranges 1-5 step expressions like every-15-minutes and the named
// macros hourly/daily/weekly/monthly/yearly. Returns null on unparseable
// input so the scheduler treats bad rows as never instead of crash-looping.
const nextFiring = (raw: string, after: Date): Date | null => {
  const expr = raw.trim()
  const resolved = expr in NAMED ? (NAMED[expr] as string) : expr
  const fields = resolved.split(/\s+/)
  if (fields.length !== 5) return null
  const minutes = parseField(fields[0]!, RANGES.m)
  const hours = parseField(fields[1]!, RANGES.h)
  const doms = parseField(fields[2]!, RANGES.dom)
  const months = parseField(fields[3]!, RANGES.mon)
  const dows = parseField(fields[4]!, RANGES.dow)
  if (
    minutes === null ||
    hours === null ||
    doms === null ||
    months === null ||
    dows === null
  ) {
    return null
  }
  const cur = new Date(Math.ceil(after.getTime() / 60_000) * 60_000)
  for (let i = 0; i < 60 * 24 * 366; i++) {
    if (
      minutes.has(cur.getUTCMinutes()) &&
      hours.has(cur.getUTCHours()) &&
      doms.has(cur.getUTCDate()) &&
      months.has(cur.getUTCMonth() + 1) &&
      dows.has(cur.getUTCDay())
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
    task: ScheduleTaskRow
  ): Promise<void> {
    const payload: Record<string, string | number | boolean> =
      task.payload ?? {}
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
        const explicit = typeof payload["name"] === "string" ? payload["name"] : ""
        const stamp = new Date()
          .toISOString()
          .replace(/:/g, "-")
          .replace(/\./g, "-")
        const name = explicit !== "" ? explicit : "scheduled-" + stamp
        await runBackup({ db: this.db, serverId, name })
        return
      }
      default:
        return
    }
  }
}
