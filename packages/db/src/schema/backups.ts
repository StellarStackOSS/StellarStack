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
 * Per-server S3-compatible backup destination. One row per server; absent
 * row means backups land locally on the node only. Credentials are stored
 * here in the clear because the panel is the system of record — at-rest
 * encryption is a v2 concern and isn't part of M11.
 */
export const backupDestinationsTable = pgTable("backup_destinations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  serverId: uuid("server_id")
    .notNull()
    .unique()
    .references(() => serversTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  region: text("region").notNull(),
  bucket: text("bucket").notNull(),
  prefix: text("prefix").notNull().default(""),
  accessKeyId: text("access_key_id").notNull(),
  secretAccessKey: text("secret_access_key").notNull(),
  forcePathStyle: boolean("force_path_style").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Backup record. `storage` indicates where the bytes live; `s3ObjectKey` is
 * populated only for S3-backed backups. `state` mirrors the lifecycle
 * (pending → ready / failed) so partially-completed jobs are visible in the
 * panel.
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
    state: text("state", {
      enum: ["pending", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    failureCode: text("failure_code"),
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
    index("backups_state_idx").on(table.state),
  ]
)

export type BackupRow = typeof backupsTable.$inferSelect
export type BackupInsert = typeof backupsTable.$inferInsert
export type BackupDestinationRow = typeof backupDestinationsTable.$inferSelect
export type BackupDestinationInsert = typeof backupDestinationsTable.$inferInsert
