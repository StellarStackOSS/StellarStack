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

import { usersTable } from "@workspace/db/schema/auth"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"

/**
 * A database host is a long-running container the daemon manages that
 * exposes a database engine (postgres, mysql, mariadb, mongodb).
 * Game servers attach logical databases to it via the `databasesTable`.
 *
 * `dbType` is a key into the static `DatabaseType` registry in
 * `@workspace/shared/databases`. `rootPasswordEncrypted` is the
 * AES-256-GCM payload of the engine's super-user password (used by the
 * API to provision and drop logical databases).
 */
export const databaseHostsTable = pgTable(
  "database_hosts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodesTable.id, { onDelete: "restrict" }),
    allocationId: uuid("allocation_id")
      .notNull()
      .references(() => nodeAllocationsTable.id, { onDelete: "restrict" }),
    dbType: text("db_type").notNull(),
    rootUser: text("root_user").notNull(),
    rootPasswordEncrypted: text("root_password_encrypted").notNull(),
    memoryLimitMb: bigint("memory_limit_mb", { mode: "number" }).notNull(),
    diskLimitMb: bigint("disk_limit_mb", { mode: "number" }).notNull(),
    status: text("status", {
      enum: ["offline", "starting", "running", "stopping"],
    })
      .notNull()
      .default("offline"),
    suspended: boolean("suspended").notNull().default(false),
    shared: boolean("shared").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("database_hosts_node_id_idx").on(table.nodeId)]
)

/**
 * A logical database carved out of a database host and bound to a game
 * server. The owning user is derived from `serversTable.ownerId`.
 */
export const databasesTable = pgTable(
  "databases",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hostId: uuid("host_id")
      .notNull()
      .references(() => databaseHostsTable.id, { onDelete: "cascade" }),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .references(() => usersTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    username: text("username").notNull(),
    passwordEncrypted: text("password_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("databases_host_id_idx").on(table.hostId),
    index("databases_server_id_idx").on(table.serverId),
  ]
)

export type DatabaseHostRow = typeof databaseHostsTable.$inferSelect
export type DatabaseHostInsert = typeof databaseHostsTable.$inferInsert
export type DatabaseRow = typeof databasesTable.$inferSelect
export type DatabaseInsert = typeof databasesTable.$inferInsert
