import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { serversTable } from "@workspace/db/schema/servers"

/**
 * Mirror of BullMQ job state for cheap reads from the panel and a permanent
 * progress history. Updated by the worker as jobs run; rows persist after the
 * BullMQ job is removed from Redis.
 */
export const jobsProgressTable = pgTable(
  "jobs_progress",
  {
    jobId: text("job_id").primaryKey(),
    serverId: uuid("server_id").references(() => serversTable.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    percent: bigint("percent", { mode: "number" }).notNull().default(0),
    messageCode: text("message_code"),
    state: text("state", {
      enum: ["queued", "running", "succeeded", "failed", "cancelled"],
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("jobs_progress_server_id_idx").on(table.serverId)]
)

export type JobProgressRow = typeof jobsProgressTable.$inferSelect
export type JobProgressInsert = typeof jobsProgressTable.$inferInsert
