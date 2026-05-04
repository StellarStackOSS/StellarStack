import { asc, eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { installLogsTable } from "@workspace/db/schema/install"
import { nodesTable } from "@workspace/db/schema/nodes"
import {
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import type { Blueprint } from "@workspace/shared/blueprint.types"

import { callDaemon } from "@/lib/DaemonHttp"

type JobState = "pending" | "running" | "succeeded" | "failed"

export type InstallJob = {
  serverId: string
  state: JobState
  startedAt: Date
  finishedAt: Date | null
  exitCode: number | null
  log: { stream: "stdout" | "stderr"; line: string }[]
}

const MAX_LOG_LINES = 5_000

/**
 * In-memory tracker for install jobs. Persisting to a `install_jobs`
 * table is a phase-2 enhancement; for now if the API process dies mid-
 * install the operator restarts the install (the daemon's container
 * will have either completed or be still running, in which case the
 * install's effects are visible in the bind mount).
 */
export class InstallRunner {
  private readonly jobs = new Map<string, InstallJob>()

  public constructor(private readonly db: Db) {}

  public get(serverId: string): InstallJob | undefined {
    return this.jobs.get(serverId)
  }

  /**
   * Read persisted log lines for a server. Used when the API process
   * restarts mid-install: the in-memory job is gone, but the log rows
   * survive so the install panel can keep rendering.
   */
  public async logsFromDb(
    serverId: string
  ): Promise<{ stream: "stdout" | "stderr"; line: string }[]> {
    const rows = await this.db
      .select({ stream: installLogsTable.stream, line: installLogsTable.line })
      .from(installLogsTable)
      .where(eq(installLogsTable.serverId, serverId))
      .orderBy(asc(installLogsTable.seq))
    return rows.map((r) => ({ stream: r.stream, line: r.line }))
  }

  public list(): InstallJob[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Kick off an install for the given server. Returns immediately;
   * progress is observable via `get(serverId)`.
   */
  public async enqueue(serverId: string): Promise<InstallJob> {
    const existing = this.jobs.get(serverId)
    if (existing && existing.state === "running") {
      return existing
    }
    const job: InstallJob = {
      serverId,
      state: "pending",
      startedAt: new Date(),
      finishedAt: null,
      exitCode: null,
      log: [],
    }
    this.jobs.set(serverId, job)
    void this.run(job).catch((err: unknown) => {
      job.state = "failed"
      job.finishedAt = new Date()
      job.log.push({
        stream: "stderr",
        line: `install runner: ${err instanceof Error ? err.message : String(err)}`,
      })
    })
    return job
  }

  private async run(job: InstallJob): Promise<void> {
    job.state = "running"
    // Wipe any stale log rows from a prior install so the live read
    // doesn't show two runs concatenated.
    await this.db
      .delete(installLogsTable)
      .where(eq(installLogsTable.serverId, job.serverId))
    let seq = 0

    const server = (
      await this.db
        .select()
        .from(serversTable)
        .where(eq(serversTable.id, job.serverId))
        .limit(1)
    )[0]
    if (server === undefined) throw new Error("server not found")
    const node = (
      await this.db
        .select()
        .from(nodesTable)
        .where(eq(nodesTable.id, server.nodeId))
        .limit(1)
    )[0]
    if (node === undefined) throw new Error("node not found")
    if (node.daemonPublicKey === null) throw new Error("node not paired")
    const blueprint = (
      await this.db
        .select()
        .from(blueprintsTable)
        .where(eq(blueprintsTable.id, server.blueprintId))
        .limit(1)
    )[0]
    if (blueprint === undefined) throw new Error("blueprint not found")

    const blueprintData = blueprint as unknown as Blueprint & {
      installImage: string
      installEntrypoint: string
      installScript: string
    }

    // Resolve install env: blueprint variable defaults overlaid with the
    // server's persisted values. Mirrors what the daemon would compute
    // locally, but assembled here so we can keep the daemon endpoint a
    // pure executor.
    const variableRows = await this.db
      .select()
      .from(serverVariablesTable)
      .where(eq(serverVariablesTable.serverId, job.serverId))
    const env: Record<string, string> = {}
    for (const v of blueprintData.variables) {
      env[v.key] = v.default
    }
    for (const r of variableRows) {
      env[r.variableKey] = r.value
    }
    env["SERVER_MEMORY"] = String(server.memoryLimitMb)

    const baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonPort}`
    const resp = await callDaemon({
      baseUrl,
      nodeId: node.id,
      signingKeyHex: node.daemonPublicKey,
      method: "POST",
      path: `/api/servers/${server.id}/install`,
      body: {
        image: blueprintData.installImage,
        entrypoint: blueprintData.installEntrypoint,
        script: blueprintData.installScript,
        environment: env,
      },
    })
    if (!resp.ok || resp.body === null) {
      job.state = "failed"
      job.finishedAt = new Date()
      job.log.push({
        stream: "stderr",
        line: `daemon install: ${resp.status} ${resp.statusText}`,
      })
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (line.trim().length === 0) continue
        try {
          const frame = JSON.parse(line) as
            | { stream: "stdout" | "stderr"; line: string }
            | { exitCode: number }
          if ("exitCode" in frame) {
            job.exitCode = frame.exitCode
            job.state = frame.exitCode === 0 ? "succeeded" : "failed"
            job.finishedAt = new Date()
            await this.db
              .update(serversTable)
              .set({
                installState: frame.exitCode === 0 ? "succeeded" : "failed",
                updatedAt: new Date(),
              })
              .where(eq(serversTable.id, job.serverId))
          } else {
            job.log.push(frame)
            if (job.log.length > MAX_LOG_LINES) {
              job.log.splice(0, job.log.length - MAX_LOG_LINES)
            }
            seq += 1
            void this.db
              .insert(installLogsTable)
              .values({
                serverId: job.serverId,
                seq,
                stream: frame.stream,
                line: frame.line,
              })
              .catch(() => {
                // Best-effort persistence; in-memory log is still kept.
              })
          }
        } catch {
          // ignore malformed line
        }
      }
    }
    if (job.state === "running") {
      // Stream ended without an exitCode frame; treat as failure.
      job.state = "failed"
      job.finishedAt = new Date()
    }
  }
}
