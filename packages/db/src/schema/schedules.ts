import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { serversTable } from "@workspace/db/schema/servers"

/**
 * Cron-style schedule attached to a server. The worker queries due rows on a
 * tick and enqueues the configured tasks in order.
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
 * One step in a schedule. Steps run sequentially with a per-step delay.
 */
export const scheduleTasksTable = pgTable(
  "schedule_tasks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedulesTable.id, { onDelete: "cascade" }),
    sortOrder: text("sort_order").notNull(),
    action: text("action", {
      enum: ["power", "command", "backup"],
    }).notNull(),
    payload: jsonb("payload").$type<Record<string, string | number>>(),
    delaySeconds: text("delay_seconds").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("schedule_tasks_schedule_id_idx").on(table.scheduleId)]
)

export type ScheduleRow = typeof schedulesTable.$inferSelect
export type ScheduleInsert = typeof schedulesTable.$inferInsert
export type ScheduleTaskRow = typeof scheduleTasksTable.$inferSelect
