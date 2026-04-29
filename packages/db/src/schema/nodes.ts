import { sql } from "drizzle-orm"
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * A node is a host machine running `stellar-daemon`. Capacity columns are
 * advisory limits enforced when scheduling new servers — actual use is
 * tracked via `servers.{memory,disk}_limit` summed against this row.
 */
export const nodesTable = pgTable(
  "nodes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    fqdn: text("fqdn").notNull(),
    scheme: text("scheme", { enum: ["http", "https"] }).notNull(),
    daemonPort: integer("daemon_port").notNull(),
    sftpPort: integer("sftp_port").notNull(),
    daemonPublicKey: text("daemon_public_key"),
    memoryTotalMb: bigint("memory_total_mb", { mode: "number" }).notNull(),
    diskTotalMb: bigint("disk_total_mb", { mode: "number" }).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("nodes_connected_at_idx").on(table.connectedAt)]
)

/**
 * Allocation pool entry for a node. Each row reserves a single `(ip, port)`
 * pair that may be assigned to one server. `serverId` is null when free.
 */
export const nodeAllocationsTable = pgTable(
  "node_allocations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodesTable.id, { onDelete: "cascade" }),
    ip: text("ip").notNull(),
    port: integer("port").notNull(),
    alias: text("alias"),
    serverId: uuid("server_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("node_allocations_node_ip_port_unique").on(
      table.nodeId,
      table.ip,
      table.port
    ),
    index("node_allocations_server_id_idx").on(table.serverId),
  ]
)

/**
 * One-time pairing tokens. A row is created when an admin starts a node-pair
 * flow and consumed when `stellar-daemon configure <token>` succeeds.
 */
export const nodePairingTokensTable = pgTable("node_pairing_tokens", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type NodeRow = typeof nodesTable.$inferSelect
export type NodeInsert = typeof nodesTable.$inferInsert
export type NodeAllocationRow = typeof nodeAllocationsTable.$inferSelect
export type NodeAllocationInsert = typeof nodeAllocationsTable.$inferInsert
export type NodePairingTokenRow = typeof nodePairingTokensTable.$inferSelect
