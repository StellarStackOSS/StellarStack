import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import type { ServerLifecycleState } from "@workspace/shared/events.types"

import { usersTable } from "@workspace/db/schema/auth"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"

/**
 * A managed Docker container instance. Status mirrors the lifecycle state
 * machine in `@workspace/shared/events.types`.
 */
export const serversTable = pgTable(
  "servers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodesTable.id, { onDelete: "restrict" }),
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => blueprintsTable.id, { onDelete: "restrict" }),
    primaryAllocationId: uuid("primary_allocation_id").references(
      () => nodeAllocationsTable.id,
      { onDelete: "restrict" }
    ),
    /**
     * Server splitting: a child instance carves a slice out of its
     * parent's resource pool. One level deep — children cannot themselves
     * have children. Cascade delete: removing the parent removes every
     * child it spawned.
     */
    parentId: uuid("parent_id").references((): any => serversTable.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    memoryLimitMb: bigint("memory_limit_mb", { mode: "number" }).notNull(),
    cpuLimitPercent: bigint("cpu_limit_percent", { mode: "number" }).notNull(),
    diskLimitMb: bigint("disk_limit_mb", { mode: "number" }).notNull(),
    dockerImage: text("docker_image").notNull(),
    startupExtra: text("startup_extra"),
    allocationLimit: integer("allocation_limit").notNull().default(3),
    /**
     * Maximum number of backups the server can hold. The frontend
     * disables the create button when count >= limit; the API also
     * rejects creates past it. Mirrors Pelican's per-server backup cap.
     */
    backupLimit: integer("backup_limit").notNull().default(5),
    status: text("status").$type<ServerLifecycleState>().notNull().default("offline"),
    /**
     * Install lifecycle is tracked separately from the live container
     * status: a server can be `installing` while its container is offline.
     * Pelican-shape — no probe-driven mid-state on the lifecycle enum.
     */
    installState: text("install_state")
      .$type<"pending" | "running" | "succeeded" | "failed">()
      .notNull()
      .default("pending"),
    suspended: boolean("suspended").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("servers_owner_id_idx").on(table.ownerId),
    index("servers_node_id_idx").on(table.nodeId),
    index("servers_status_idx").on(table.status),
    index("servers_parent_id_idx").on(table.parentId),
  ]
)

/**
 * Many-to-many bridge between servers and allocations. The primary allocation
 * is also stored on `servers.primaryAllocationId` for fast lookups.
 */
export const serverAllocationsTable = pgTable(
  "server_allocations",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    allocationId: uuid("allocation_id")
      .notNull()
      .references(() => nodeAllocationsTable.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.allocationId] }),
  ]
)

/**
 * Per-server values for the variables a blueprint declares.
 */
export const serverVariablesTable = pgTable(
  "server_variables",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    variableKey: text("variable_key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.variableKey] }),
  ]
)

/**
 * Subuser permissions for a server. `permissions` holds the better-auth
 * statement strings (`console.read`, `files.write`, …).
 */
export const serverSubusersTable = pgTable(
  "server_subusers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    permissions: jsonb("permissions").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("server_subusers_server_id_idx").on(table.serverId),
    index("server_subusers_user_id_idx").on(table.userId),
  ]
)

export type ServerRow = typeof serversTable.$inferSelect
export type ServerInsert = typeof serversTable.$inferInsert
export type ServerAllocationRow = typeof serverAllocationsTable.$inferSelect
export type ServerVariableRow = typeof serverVariablesTable.$inferSelect
export type ServerSubuserRow = typeof serverSubusersTable.$inferSelect
