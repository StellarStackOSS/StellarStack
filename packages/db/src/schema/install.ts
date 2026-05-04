import { sql } from "drizzle-orm"
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
 * One log line emitted during an install run. Inserted live by the API
 * as it consumes the daemon's NDJSON stream so the frontend's poll
 * endpoint can render history even after the API process restarts.
 */
export const installLogsTable = pgTable(
  "install_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    /** Monotonic per-server sequence so paginated reads stay ordered. */
    seq: bigint("seq", { mode: "number" }).notNull(),
    stream: text("stream", { enum: ["stdout", "stderr"] }).notNull(),
    line: text("line").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("install_logs_server_id_seq_idx").on(table.serverId, table.seq),
  ]
)

export type InstallLogRow = typeof installLogsTable.$inferSelect
export type InstallLogInsert = typeof installLogsTable.$inferInsert
