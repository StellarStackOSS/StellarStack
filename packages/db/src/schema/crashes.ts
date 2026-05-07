import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { serversTable } from "@workspace/db/schema/servers"

export const serverCrashesTable = pgTable(
  "server_crashes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    exitCode: integer("exit_code").notNull(),
    signal: text("signal"),
    oomKilled: integer("oom_killed").notNull().default(0),
    logTail: text("log_tail").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("server_crashes_server_id_occurred_at_idx").on(t.serverId, t.occurredAt)]
)

export type ServerCrashRow = typeof serverCrashesTable.$inferSelect
export type ServerCrashInsert = typeof serverCrashesTable.$inferInsert
