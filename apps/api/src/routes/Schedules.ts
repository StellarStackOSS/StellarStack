import { and, eq, inArray } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  scheduleEdgesTable,
  scheduleNodesTable,
  schedulesTable,
} from "@workspace/db/schema/schedules"
import { serversTable } from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

// ---------------------------------------------------------------------------
// Wire shapes.
// ---------------------------------------------------------------------------

// Subtypes match the union in `@workspace/shared/schedule.types`. We keep the
// list local to the route so zod can enforce it without pulling in TS-only
// types (zod is the source of truth for validation).
const ALL_SUBTYPES = [
  "cron",
  "power.start",
  "power.stop",
  "power.restart",
  "power.kill",
  "backup.create",
  "console.send",
  "state.offline",
  "state.online",
  "backup.complete",
  "delay.seconds",
] as const

const nodeInputSchema = z.object({
  /** Client-assigned UUID. We accept it so edges can reference nodes that
   *  haven't hit the DB yet, in the same transaction. */
  id: z.string().uuid(),
  kind: z.enum(["trigger", "action", "wait"]),
  subtype: z.enum(ALL_SUBTYPES),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
})

const edgeInputSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
})

const flowInputSchema = z.object({
  nodes: z.array(nodeInputSchema),
  edges: z.array(edgeInputSchema),
})

const scheduleInputSchema = z.object({
  name: z.string().min(1).max(120),
  cron: z.string().min(1).max(120),
  enabled: z.boolean(),
  onlyWhenOnline: z.boolean(),
  flow: flowInputSchema,
})

// ---------------------------------------------------------------------------
// Validation: the editor produces linear chains, but we validate generic
// graph constraints so the runner is safe regardless of how the flow was
// constructed:
//
//   - exactly one trigger node, and it must be the entry (no incoming
//     edges)
//   - all edges reference nodes that exist in the same flow
//   - no cycles (the runner must terminate)
//   - no orphans except the trigger (every node is reachable from trigger)
//   - kind 'trigger' subtypes must be trigger subtypes; same for action/wait
// ---------------------------------------------------------------------------

const TRIGGER_SUBTYPES = new Set(["cron"])
const ACTION_SUBTYPES = new Set([
  "power.start",
  "power.stop",
  "power.restart",
  "power.kill",
  "backup.create",
  "console.send",
])
const WAIT_SUBTYPES = new Set([
  "state.offline",
  "state.online",
  "backup.complete",
  "delay.seconds",
])

type FlowInput = z.infer<typeof flowInputSchema>

const validateFlow = (flow: FlowInput): void => {
  // Kind/subtype consistency.
  for (const n of flow.nodes) {
    if (n.kind === "trigger" && !TRIGGER_SUBTYPES.has(n.subtype)) {
      throw new ApiException("validation.invalid", { status: 400 })
    }
    if (n.kind === "action" && !ACTION_SUBTYPES.has(n.subtype)) {
      throw new ApiException("validation.invalid", { status: 400 })
    }
    if (n.kind === "wait" && !WAIT_SUBTYPES.has(n.subtype)) {
      throw new ApiException("validation.invalid", { status: 400 })
    }
  }

  // Exactly one trigger.
  const triggers = flow.nodes.filter((n) => n.kind === "trigger")
  if (triggers.length !== 1) {
    throw new ApiException("validation.invalid", { status: 400 })
  }
  const trigger = triggers[0]!

  const idSet = new Set(flow.nodes.map((n) => n.id))
  for (const e of flow.edges) {
    if (!idSet.has(e.fromNodeId) || !idSet.has(e.toNodeId)) {
      throw new ApiException("validation.invalid", { status: 400 })
    }
  }

  // Trigger has no incoming edges.
  if (flow.edges.some((e) => e.toNodeId === trigger.id)) {
    throw new ApiException("validation.invalid", { status: 400 })
  }

  // Reachability + cycle detection (DFS from trigger).
  const adjacency = new Map<string, string[]>()
  for (const n of flow.nodes) adjacency.set(n.id, [])
  for (const e of flow.edges) {
    adjacency.get(e.fromNodeId)!.push(e.toNodeId)
  }
  const visited = new Set<string>()
  const stack = new Set<string>()
  const dfs = (id: string): void => {
    if (stack.has(id)) {
      throw new ApiException("validation.invalid", { status: 400 })
    }
    if (visited.has(id)) return
    visited.add(id)
    stack.add(id)
    for (const next of adjacency.get(id) ?? []) dfs(next)
    stack.delete(id)
  }
  dfs(trigger.id)
  // All non-trigger nodes must be reachable.
  if (visited.size !== flow.nodes.length) {
    throw new ApiException("validation.invalid", { status: 400 })
  }
}

// ---------------------------------------------------------------------------
// Routes.
// ---------------------------------------------------------------------------

export const buildSchedulesRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/schedules", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const schedules = await db
        .select()
        .from(schedulesTable)
        .where(eq(schedulesTable.serverId, serverId))
      const ids = schedules.map((s) => s.id)
      const [nodes, edges] =
        ids.length === 0
          ? [[], []]
          : await Promise.all([
              db
                .select()
                .from(scheduleNodesTable)
                .where(inArray(scheduleNodesTable.scheduleId, ids)),
              db
                .select()
                .from(scheduleEdgesTable)
                .where(inArray(scheduleEdgesTable.scheduleId, ids)),
            ])
      const nodesBySchedule = new Map<string, typeof nodes>()
      for (const n of nodes) {
        const list = nodesBySchedule.get(n.scheduleId) ?? []
        list.push(n)
        nodesBySchedule.set(n.scheduleId, list)
      }
      const edgesBySchedule = new Map<string, typeof edges>()
      for (const e of edges) {
        const list = edgesBySchedule.get(e.scheduleId) ?? []
        list.push(e)
        edgesBySchedule.set(e.scheduleId, list)
      }
      return c.json({
        schedules: schedules.map((s) => ({
          ...s,
          flow: {
            nodes: nodesBySchedule.get(s.id) ?? [],
            edges: edgesBySchedule.get(s.id) ?? [],
          },
        })),
      })
    })
    .post("/:serverId/schedules", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const parsed = scheduleInputSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      validateFlow(parsed.data.flow)
      const out = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schedulesTable)
          .values({
            serverId,
            name: parsed.data.name,
            cron: parsed.data.cron,
            enabled: parsed.data.enabled,
            onlyWhenOnline: parsed.data.onlyWhenOnline,
          })
          .returning()
        if (row === undefined) throw new Error("insert failed")
        await persistFlow(tx, row.id, parsed.data.flow)
        return row
      })
      return c.json({ schedule: out })
    })
    .patch("/:serverId/schedules/:scheduleId", async (c) => {
      const serverId = c.req.param("serverId")
      const scheduleId = c.req.param("scheduleId")
      await assertAccess(db, c.get("user"), serverId)
      const parsed = scheduleInputSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      validateFlow(parsed.data.flow)
      const out = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(schedulesTable)
          .set({
            name: parsed.data.name,
            cron: parsed.data.cron,
            enabled: parsed.data.enabled,
            onlyWhenOnline: parsed.data.onlyWhenOnline,
          })
          .where(
            and(
              eq(schedulesTable.id, scheduleId),
              eq(schedulesTable.serverId, serverId)
            )
          )
          .returning()
        if (row === undefined) {
          throw new ApiException("internal.unexpected", { status: 404 })
        }
        // Delete children; ON DELETE CASCADE on edges → nodes handles the rest
        // when we drop the nodes.
        await tx
          .delete(scheduleEdgesTable)
          .where(eq(scheduleEdgesTable.scheduleId, scheduleId))
        await tx
          .delete(scheduleNodesTable)
          .where(eq(scheduleNodesTable.scheduleId, scheduleId))
        await persistFlow(tx, scheduleId, parsed.data.flow)
        return row
      })
      return c.json({ schedule: out })
    })
    .delete("/:serverId/schedules/:scheduleId", async (c) => {
      const serverId = c.req.param("serverId")
      const scheduleId = c.req.param("scheduleId")
      await assertAccess(db, c.get("user"), serverId)
      await db
        .delete(schedulesTable)
        .where(
          and(
            eq(schedulesTable.id, scheduleId),
            eq(schedulesTable.serverId, serverId)
          )
        )
      return c.json({ ok: true })
    })
}

const persistFlow = async (
  tx: Db,
  scheduleId: string,
  flow: FlowInput
): Promise<void> => {
  if (flow.nodes.length > 0) {
    await tx.insert(scheduleNodesTable).values(
      flow.nodes.map((n) => ({
        id: n.id,
        scheduleId,
        kind: n.kind,
        subtype: n.subtype,
        payload: (n.payload ?? {}) as Record<string, unknown>,
        position: n.position,
      }))
    )
  }
  if (flow.edges.length > 0) {
    await tx.insert(scheduleEdgesTable).values(
      flow.edges.map((e) => ({
        scheduleId,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
      }))
    )
  }
}

const assertAccess = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<void> => {
  const server = (
    await db
      .select({ ownerId: serversTable.ownerId })
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (server === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  if (user.isAdmin === true) return
  if (server.ownerId === user.id) return
  throw new ApiException("permissions.denied", { status: 403 })
}
