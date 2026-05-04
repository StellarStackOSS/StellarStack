import { createHmac, timingSafeEqual } from "node:crypto"

import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { lifecycleStateSchema } from "@workspace/shared/events"
import type { Blueprint } from "@workspace/shared/blueprint.types"
import { ApiException } from "@workspace/shared/errors"

import { writeAudit } from "@/lib/Audit"
import type { Env } from "@/env"
import type { StatusCache } from "@/lib/StatusCache"

const statusCallbackSchema = z.object({
  previousState: lifecycleStateSchema,
  newState: lifecycleStateSchema,
  at: z.string(),
})

const auditCallbackSchema = z.object({
  actorId: z.string().uuid().nullable(),
  action: z.string().min(1).max(120),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
})

/**
 * Daemon → API callback surface. Today: container status only. Mounted
 * unauthenticated at the route level — each handler verifies the per-
 * node HMAC signature itself so a missing/expired signature can't reach
 * a handler.
 */
export const buildRemoteRoute = (params: {
  db: Db
  env: Env
  statusCache: StatusCache
}) => {
  const { db, env, statusCache } = params
  return new Hono()
    .post("/servers/:id/container/status", async (c) => {
      const serverId = c.req.param("id")
      const ok = await verifyDaemonSignature({
        db,
        env,
        headers: c.req.raw.headers,
      })
      if (!ok) {
        throw new ApiException("auth.session.invalid", { status: 401 })
      }
      const parsed = statusCallbackSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw new ApiException("validation.failed", { status: 422 })
      }
      await Promise.all([
        db
          .update(serversTable)
          .set({ status: parsed.data.newState, updatedAt: new Date() })
          .where(eq(serversTable.id, serverId)),
        statusCache.set(serverId, parsed.data.newState),
      ])
      // If the daemon's transition carries a reason code we recognise as
      // crash-shaped, persist it as audit metadata so the activity tab
      // surfaces it. Reason codes follow `servers.lifecycle.crashed.*`.
      if (
        parsed.data.newState === "offline" &&
        parsed.data.previousState === "running"
      ) {
        void writeAudit({
          db,
          actorId: null,
          action: "servers.lifecycle.exited",
          targetType: "server",
          targetId: serverId,
        })
      }
      return c.json({ ok: true })
    })
    .get("/servers/:id/config", async (c) => {
      const ok = await verifyDaemonSignature({
        db,
        env,
        headers: c.req.raw.headers,
      })
      if (!ok) {
        throw new ApiException("auth.session.invalid", { status: 401 })
      }
      const serverId = c.req.param("id")
      const row = (
        await db
          .select({ server: serversTable, blueprint: blueprintsTable })
          .from(serversTable)
          .innerJoin(
            blueprintsTable,
            eq(blueprintsTable.id, serversTable.blueprintId)
          )
          .where(eq(serversTable.id, serverId))
          .limit(1)
      )[0]
      if (row === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      const blueprint = row.blueprint as unknown as Blueprint
      const allocations = await db
        .select({
          id: nodeAllocationsTable.id,
          ip: nodeAllocationsTable.ip,
          port: nodeAllocationsTable.port,
        })
        .from(nodeAllocationsTable)
        .innerJoin(
          serverAllocationsTable,
          eq(serverAllocationsTable.allocationId, nodeAllocationsTable.id)
        )
        .where(eq(serverAllocationsTable.serverId, serverId))
      const variableRows = await db
        .select()
        .from(serverVariablesTable)
        .where(eq(serverVariablesTable.serverId, serverId))
      const env_: Record<string, string> = {}
      for (const v of blueprint.variables) env_[v.key] = v.default
      for (const r of variableRows) env_[r.variableKey] = r.value
      env_["SERVER_MEMORY"] = String(row.server.memoryLimitMb)
      const startupCommand = row.server.startupExtra
        ? `${blueprint.startupCommand} ${row.server.startupExtra}`
        : blueprint.startupCommand
      // Translate the blueprint stop signal into the daemon's StopConfig
      // shape: leading `^` means "write rest to stdin", anything else is
      // a kill signal name (SIGTERM, SIGINT, …).
      const sig = blueprint.stopSignal ?? ""
      const stop = sig.startsWith("^")
        ? { type: "command" as const, value: sig.slice(1) }
        : sig
          ? { type: "signal" as const, value: sig }
          : { type: "" as const, value: "" }
      return c.json({
        dockerImage: row.server.dockerImage,
        startupCommand,
        environment: env_,
        stop,
        memoryLimitMb: row.server.memoryLimitMb,
        cpuLimitPercent: row.server.cpuLimitPercent,
        ports: allocations.map((a) => ({
          hostIp: a.ip,
          hostPort: a.port,
          containerPort: a.port,
        })),
      })
    })
    .post("/heartbeat", async (c) => {
      const ok = await verifyDaemonSignature({
        db,
        env,
        headers: c.req.raw.headers,
      })
      if (!ok) {
        throw new ApiException("auth.session.invalid", { status: 401 })
      }
      const nodeId = c.req.raw.headers.get("x-stellar-node-id") ?? ""
      await db
        .update(nodesTable)
        .set({ connectedAt: new Date() })
        .where(eq(nodesTable.id, nodeId))
      return c.json({ ok: true })
    })
    .post("/servers/:id/audit", async (c) => {
      const serverId = c.req.param("id")
      const ok = await verifyDaemonSignature({
        db,
        env,
        headers: c.req.raw.headers,
      })
      if (!ok) {
        throw new ApiException("auth.session.invalid", { status: 401 })
      }
      const parsed = auditCallbackSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw new ApiException("validation.failed", { status: 422 })
      }
      await writeAudit({
        db,
        actorId: parsed.data.actorId,
        action: parsed.data.action,
        targetType: "server",
        targetId: serverId,
        metadata: parsed.data.metadata,
      })
      return c.json({ ok: true })
    })
}

/**
 * Verify HMAC-SHA256 over `<nodeId>|<unix-seconds>` using the node's
 * stored signing key. Mirrors the daemon's panel.Client signing scheme.
 */
const verifyDaemonSignature = async (params: {
  db: Db
  env: Env
  headers: Headers
}): Promise<boolean> => {
  const nodeId = params.headers.get("x-stellar-node-id") ?? ""
  const ts = params.headers.get("x-stellar-timestamp") ?? ""
  const auth = params.headers.get("authorization") ?? ""
  if (nodeId.length === 0 || ts.length === 0 || !auth.startsWith("Bearer ")) {
    return false
  }
  const tsInt = Number.parseInt(ts, 10)
  if (Number.isNaN(tsInt)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - tsInt) > params.env.DAEMON_HMAC_SKEW_SECONDS) {
    return false
  }
  const node = (
    await params.db
      .select({ key: nodesTable.daemonPublicKey })
      .from(nodesTable)
      .where(eq(nodesTable.id, nodeId))
      .limit(1)
  )[0]
  if (node === undefined || node.key === null) {
    return false
  }
  let provided: Buffer
  try {
    provided = Buffer.from(auth.slice("Bearer ".length), "hex")
  } catch {
    return false
  }
  const expected = createHmac("sha256", Buffer.from(node.key, "hex"))
    .update(`${nodeId}|${ts}`)
    .digest()
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}
