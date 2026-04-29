import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { serversTable } from "@workspace/db/schema/servers"

/**
 * Backup record. `storage` indicates where the bytes live; `s3ObjectKey` is
 * populated only for S3-backed backups.
 */
export const backupsTable = pgTable(
  "backups",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sha256: text("sha256"),
    bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
    storage: text("storage", { enum: ["local", "s3"] }).notNull(),
    s3ObjectKey: text("s3_object_key"),
    locked: boolean("locked").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("backups_server_id_idx").on(table.serverId),
    index("backups_completed_at_idx").on(table.completedAt),
  ]
)

export type BackupRow = typeof backupsTable.$inferSelect
export type BackupInsert = typeof backupsTable.$inferInsert
