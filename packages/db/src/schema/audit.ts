import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { usersTable } from "@workspace/db/schema/auth"

/**
 * Append-only audit log. `action` is a translation key; `metadata` stores
 * interpolation params and any additional context. Render in the admin UI.
 */
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorId: uuid("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    ip: text("ip"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<
      Record<string, string | number | boolean>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_target_idx").on(table.targetType, table.targetId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
)

export type AuditLogRow = typeof auditLogTable.$inferSelect
export type AuditLogInsert = typeof auditLogTable.$inferInsert
