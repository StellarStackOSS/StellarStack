import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { serversTable } from "./servers"

/**
 * One row per mod / resource pack / data pack / modpack installed onto
 * a server via the panel's CurseForge / Modrinth integration. The
 * source of truth for the actual files is the daemon's filesystem
 * under `<server>/data/mods` etc; this table is the panel's index so
 * it can show installed lists, check for updates, and uninstall.
 */
export const serverModsTable = pgTable(
  "server_mods",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => serversTable.id, { onDelete: "cascade" }),
    /** "modrinth" | "curseforge" — keep open as text so new providers
     *  don't require a migration. */
    platform: text("platform").notNull(),
    /** Slug or numeric id depending on platform. */
    projectId: text("project_id").notNull(),
    /** The specific file/version that's currently on disk. */
    versionId: text("version_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    /** "mod" | "resourcepack" | "datapack" | "shader" | "modpack" */
    kind: text("kind").notNull(),
    loader: text("loader"),
    gameVersion: text("game_version"),
    /** Path inside the server's data dir, e.g. `mods/sodium-0.5.jar`. */
    filePath: text("file_path").notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    installedAt: timestamp("installed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("server_mods_server_id_idx").on(table.serverId),
    unique("server_mods_server_project_unique").on(
      table.serverId,
      table.platform,
      table.projectId
    ),
  ]
)

export type ServerModRow = typeof serverModsTable.$inferSelect
export type ServerModInsert = typeof serverModsTable.$inferInsert
