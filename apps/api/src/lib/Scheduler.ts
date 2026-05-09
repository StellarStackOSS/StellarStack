import { and, eq, lte } from "drizzle-orm"

import { backupsTable } from "@workspace/db/schema/backups"
import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import {
  type ScheduleEdgeRow,
  type ScheduleNodeRow,
  scheduleEdgesTable,
  scheduleNodesTable,
  schedulesTable,
} from "@workspace/db/schema/schedules"
import { serversTable } from "@workspace/db/schema/servers"

import { runBackup } from "@/lib/BackupRunner"
import { callDaemon } from "@/lib/DaemonHttp"
import type { StatusCache } from "@/lib/StatusCache"

const TICK_MS = 30_000
const STATE_POLL_MS = 1_000
const BACKUP_POLL_MS = 2_000

// Default wait timeouts kick in when the node payload doesn't specify one.
// Generous defaults — a stuck schedule is better than a quiet truncation.
const DEFAULT_TIMEOUT_OFFLINE_S = 120
const DEFAULT_TIMEOUT_ONLINE_S = 300
const DEFAULT_TIMEOUT_BACKUP_S = 1_800

type FieldRange = { min: number; max: number }

const RANGES: Record<"m" | "h" | "dom" | "mon" | "dow", FieldRange> = {
  m: { min: 0, max: 59 },
  h: { min: 0, max: 23 },
  dom: { min: 1, max: 31 },
  mon: { min: 1, max: 12 },
  dow: { min: 0, max: 6 },
}

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

// ---------------------------------------------------------------------------
// Flow executor — walks from the trigger node, dispatching action nodes and
// blocking on wait nodes. Single executor per schedule run; runs are
// allowed to overlap across distinct schedules but never within the same
// schedule (the row's `nextRunAt` is bumped before the run starts).
// ---------------------------------------------------------------------------

type FlowDeps = {
  db: Db
  statusCache: StatusCache
  serverId: string
  baseUrl: string
  nodeId: string
  signingKeyHex: string
}

class FlowExecutor {
  // The most recently created backup id in this run, used by
  // `wait.backup.complete` so a single schedule can wait on the backup it
  // just took (rather than any pending backup in the system).
  private lastBackupId: string | null = null

  public constructor(private readonly deps: FlowDeps) {}

  public async run(
    nodes: ScheduleNodeRow[],
    edges: ScheduleEdgeRow[]
  ): Promise<void> {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const outgoing = new Map<string, string[]>()
    for (const n of nodes) outgoing.set(n.id, [])
    for (const e of edges) outgoing.get(e.fromNodeId)?.push(e.toNodeId)

    const trigger = nodes.find((n) => n.kind === "trigger")
    if (trigger === undefined) return

    let currentId: string | undefined = trigger.id
    const visited = new Set<string>()
    while (currentId !== undefined) {
      if (visited.has(currentId)) {
        // Defensive: schema validation forbids cycles, but if one slipped
        // through we exit rather than spin.
        return
      }
      visited.add(currentId)

      const node = byId.get(currentId)
      if (node === undefined) return

      try {
        if (node.kind === "action") await this.runAction(node)
        else if (node.kind === "wait") await this.runWait(node)
        // trigger: no-op, just the entry point.
      } catch (err) {
        console.error(
          `schedule node ${node.id} (${node.kind}.${node.subtype}) failed:`,
          err
        )
        // A failing node aborts the rest of the flow — better to stop than
        // to e.g. start a server that didn't actually back up.
        return
      }

      const nextNodes: string[] = outgoing.get(currentId) ?? []
      // Linear walk — take the single outgoing edge. Branching would need
      // a richer execution model (parallel walks + join semantics), out
      // of scope for the linear editor.
      currentId = nextNodes[0]
    }
  }

  private async runAction(node: ScheduleNodeRow): Promise<void> {
    const payload = (node.payload ?? {}) as Record<string, unknown>
    if (node.subtype.startsWith("power.")) {
      const action = node.subtype.slice("power.".length)
      if (
        action !== "start" &&
        action !== "stop" &&
        action !== "restart" &&
        action !== "kill"
      ) {
        return
      }
      await callDaemon({
        baseUrl: this.deps.baseUrl,
        nodeId: this.deps.nodeId,
        signingKeyHex: this.deps.signingKeyHex,
        method: "POST",
        path: `/api/servers/${this.deps.serverId}/power`,
        body: { action },
      })
      return
    }
    if (node.subtype === "console.send") {
      const line =
        typeof payload["line"] === "string" ? (payload["line"] as string) : ""
      if (line === "") return
      await callDaemon({
        baseUrl: this.deps.baseUrl,
        nodeId: this.deps.nodeId,
        signingKeyHex: this.deps.signingKeyHex,
        method: "POST",
        path: `/api/servers/${this.deps.serverId}/command`,
        body: { line },
      })
      return
    }
    if (node.subtype === "backup.create") {
      const explicit =
        typeof payload["name"] === "string" ? (payload["name"] as string) : ""
      const stamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\./g, "-")
      const name = explicit !== "" ? explicit : "scheduled-" + stamp
      const id = await runBackup({
        db: this.deps.db,
        serverId: this.deps.serverId,
        name,
      })
      // Tag the just-created backup so a downstream `wait.backup.complete`
      // blocks specifically on it (rather than any pending row).
      if (id !== null) this.lastBackupId = id
    }
  }

  private async runWait(node: ScheduleNodeRow): Promise<void> {
    const payload = (node.payload ?? {}) as Record<string, unknown>
    if (node.subtype === "delay.seconds") {
      const seconds = Number(payload["seconds"] ?? 0)
      if (!Number.isFinite(seconds) || seconds <= 0) return
      await new Promise((r) => setTimeout(r, seconds * 1_000))
      return
    }
    if (node.subtype === "state.offline") {
      const timeout = waitTimeout(payload, DEFAULT_TIMEOUT_OFFLINE_S)
      await this.pollUntil(timeout, async () => {
        const status = await this.deps.statusCache.get(this.deps.serverId)
        return status === "offline" || status === null
      }, STATE_POLL_MS)
      return
    }
    if (node.subtype === "state.online") {
      const timeout = waitTimeout(payload, DEFAULT_TIMEOUT_ONLINE_S)
      await this.pollUntil(timeout, async () => {
        const status = await this.deps.statusCache.get(this.deps.serverId)
        return status === "running"
      }, STATE_POLL_MS)
      return
    }
    if (node.subtype === "backup.complete") {
      const timeout = waitTimeout(payload, DEFAULT_TIMEOUT_BACKUP_S)
      await this.pollUntil(timeout, async () => {
        const target = this.lastBackupId
        if (target === null) {
          // No tagged backup — fall back to "any pending backup for this
          // server" so the wait makes sense even if the create node was
          // skipped or failed to tag.
          const pending = await this.deps.db
            .select({ id: backupsTable.id })
            .from(backupsTable)
            .where(
              and(
                eq(backupsTable.serverId, this.deps.serverId),
                eq(backupsTable.state, "pending")
              )
            )
            .limit(1)
          return pending.length === 0
        }
        const row = (
          await this.deps.db
            .select({ state: backupsTable.state })
            .from(backupsTable)
            .where(eq(backupsTable.id, target))
            .limit(1)
        )[0]
        if (row === undefined) return true
        return row.state !== "pending"
      }, BACKUP_POLL_MS)
      return
    }
  }

  private async pollUntil(
    timeoutMs: number,
    check: () => Promise<boolean>,
    intervalMs: number
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await check()) return
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    // Timed out; we return rather than throw so the rest of the flow
    // continues (matches Pelican-style "best-effort" scheduling). Surface
    // via console so it's visible in the API logs.
    console.warn(
      `schedule wait timed out after ${timeoutMs}ms for server ${this.deps.serverId}`
    )
  }
}

const waitTimeout = (
  payload: Record<string, unknown>,
  defaultS: number
): number => {
  const raw = payload["timeoutSeconds"]
  const n = typeof raw === "number" && raw > 0 ? raw : defaultS
  return n * 1_000
}

// ---------------------------------------------------------------------------
// Scheduler — DB tick loop.
// ---------------------------------------------------------------------------

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
    void this.runDue()
      .catch((err: unknown) => {
        console.error("scheduler tick failed:", err)
      })
      .finally(() => {
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
      const next = nextFiring(schedule.cron, now)
      await this.db
        .update(schedulesTable)
        .set({
          lastRunAt: now,
          nextRunAt: next,
        })
        .where(eq(schedulesTable.id, schedule.id))
      void this.runSchedule(
        schedule.id,
        schedule.serverId,
        schedule.onlyWhenOnline
      )
    }
    // Bootstrap nextRunAt for newly-enabled schedules.
    const fresh = await this.db
      .select()
      .from(schedulesTable)
      .where(and(eq(schedulesTable.enabled, true)))
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

    const [nodes, edges] = await Promise.all([
      this.db
        .select()
        .from(scheduleNodesTable)
        .where(eq(scheduleNodesTable.scheduleId, scheduleId)),
      this.db
        .select()
        .from(scheduleEdgesTable)
        .where(eq(scheduleEdgesTable.scheduleId, scheduleId)),
    ])
    if (nodes.length === 0) return

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

    const executor = new FlowExecutor({
      db: this.db,
      statusCache: this.statusCache,
      serverId,
      baseUrl,
      nodeId: server.node.id,
      signingKeyHex: server.node.daemonPublicKey,
    })
    await executor.run(nodes, edges)
  }
}
