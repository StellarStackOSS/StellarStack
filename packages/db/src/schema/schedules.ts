import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { serversTable } from "@workspace/db/schema/servers"

/**
 * Cron-style schedule attached to a server. The runner walks the linked
 * `schedule_nodes` graph from the trigger node when `next_run_at <= now`.
 */
export const schedulesTable = pgTable(
  "schedules",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cron: text("cron").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    onlyWhenOnline: boolean("only_when_online").notNull().default(false),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("schedules_server_id_idx").on(table.serverId),
    index("schedules_next_run_at_idx").on(table.nextRunAt),
  ]
)

/**
 * One node in a schedule's flow. Three kinds: `trigger` (always exactly one
 * per schedule, the entry point), `action` (does something — power, backup,
 * console command), and `wait` (blocks the runner until a condition is met
 * or a timeout elapses).
 *
 * `subtype` is a dotted string that fully identifies what the node does
 * within its kind (e.g. `power.start`, `state.offline`, `delay.seconds`).
 * `payload` carries the per-subtype config (the command line, the delay
 * seconds, the wait timeout, etc.).
 *
 * `position` is purely an editor concern (xyflow canvas coords); the
 * runner uses edges, not positions, to walk the graph.
 */
export const scheduleNodesTable = pgTable(
  "schedule_nodes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedulesTable.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["trigger", "action", "wait"],
    }).notNull(),
    subtype: text("subtype").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    position: jsonb("position")
      .$type<{ x: number; y: number }>()
      .notNull()
      .default(sql`'{"x":0,"y":0}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("schedule_nodes_schedule_id_idx").on(table.scheduleId)]
)

/**
 * Directed edge between two nodes in the same schedule. The runner follows
 * outgoing edges from the trigger to drive execution. For the linear
 * editor, every non-tail node has exactly one outgoing edge — the table
 * supports DAG shape if we ever ship branching.
 */
export const scheduleEdgesTable = pgTable(
  "schedule_edges",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedulesTable.id, { onDelete: "cascade" }),
    fromNodeId: uuid("from_node_id")
      .notNull()
      .references(() => scheduleNodesTable.id, { onDelete: "cascade" }),
    toNodeId: uuid("to_node_id")
      .notNull()
      .references(() => scheduleNodesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("schedule_edges_schedule_id_idx").on(table.scheduleId),
    index("schedule_edges_from_node_id_idx").on(table.fromNodeId),
    unique("schedule_edges_unique_pair").on(table.fromNodeId, table.toNodeId),
  ]
)

export type ScheduleRow = typeof schedulesTable.$inferSelect
export type ScheduleInsert = typeof schedulesTable.$inferInsert
export type ScheduleNodeRow = typeof scheduleNodesTable.$inferSelect
export type ScheduleNodeInsert = typeof scheduleNodesTable.$inferInsert
export type ScheduleEdgeRow = typeof scheduleEdgesTable.$inferSelect
export type ScheduleEdgeInsert = typeof scheduleEdgesTable.$inferInsert

// ---------------------------------------------------------------------------
// Backwards-compat re-exports.
//
// The old `scheduleTasksTable` was dropped in migration 0015. Any leftover
// import will fail loudly at type-check rather than silently misbehave at
// runtime — by design, since the runtime semantics changed.
// ---------------------------------------------------------------------------

/** @deprecated Removed; use `scheduleNodesTable` + `scheduleEdgesTable`. */
export type ScheduleTaskRow = never
