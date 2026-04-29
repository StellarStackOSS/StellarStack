import { sql } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { nodesTable } from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"

/**
 * Tracks a server-transfer operation from one node to another. Rows are
 * written by the API when a transfer is requested and updated by the worker
 * as it progresses through each phase.
 */
export const serverTransfersTable = pgTable(
  "server_transfers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    sourceNodeId: uuid("source_node_id")
      .notNull()
      .references(() => nodesTable.id, { onDelete: "restrict" }),
    targetNodeId: uuid("target_node_id")
      .notNull()
      .references(() => nodesTable.id, { onDelete: "restrict" }),
    /** ID of the allocation that will become the server's new primary on the target node. */
    targetAllocationId: uuid("target_allocation_id").notNull(),
    /** One-time HMAC token the source daemon presents when pushing to the target. */
    token: text("token").notNull(),
    status: text("status")
      .$type<"pending" | "running" | "completed" | "failed">()
      .notNull()
      .default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("server_transfers_server_id_idx").on(table.serverId),
    index("server_transfers_status_idx").on(table.status),
  ]
)

export type ServerTransferRow = typeof serverTransfersTable.$inferSelect
export type ServerTransferInsert = typeof serverTransfersTable.$inferInsert
