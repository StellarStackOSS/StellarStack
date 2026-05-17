import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "./auth"

/**
 * Free-form key/value store for app-wide settings that don't deserve
 * their own table. Used for third-party API keys (Modrinth, CurseForge,
 * SMTP creds, etc.) and small operational toggles. `encrypted = true`
 * means the `value` is the hex-encoded output of `AES-256-GCM(iv|ct|tag)`
 * keyed off `BETTER_AUTH_SECRET`.
 *
 * Reads go through `apps/api/src/lib/Settings.ts` which transparently
 * decrypts. Never select * from here in a public API response — the
 * helper returns redacted shapes for the admin UI.
 */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid("updated_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
})

export type AppSettingRow = typeof appSettingsTable.$inferSelect
export type AppSettingInsert = typeof appSettingsTable.$inferInsert
