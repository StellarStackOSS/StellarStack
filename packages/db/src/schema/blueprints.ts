import { sql } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import type {
  Blueprint,
  BlueprintConfigFile,
  BlueprintLifecycle,
  BlueprintLocalizableText,
  BlueprintVariable,
} from "@workspace/shared/blueprint.types"

/**
 * Admin-authored blueprint document. JSONB columns mirror the blueprint Zod
 * schema in `@workspace/shared/blueprint`.
 */
export const blueprintsTable = pgTable("blueprints", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  schemaVersion: text("schema_version").notNull().default("1"),
  name: jsonb("name").$type<BlueprintLocalizableText>().notNull(),
  description: jsonb("description").$type<BlueprintLocalizableText>(),
  author: text("author"),
  dockerImages: jsonb("docker_images")
    .$type<Blueprint["dockerImages"]>()
    .notNull(),
  stopSignal: text("stop_signal").notNull(),
  startupCommand: text("startup_command").notNull(),
  configFiles: jsonb("config_files").$type<BlueprintConfigFile[]>(),
  variables: jsonb("variables").$type<BlueprintVariable[]>().notNull(),
  installImage: text("install_image").notNull(),
  installEntrypoint: text("install_entrypoint").notNull(),
  installScript: text("install_script").notNull(),
  lifecycle: jsonb("lifecycle").$type<BlueprintLifecycle>().notNull(),
  features: jsonb("features").$type<Record<string, string[]>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type BlueprintRow = typeof blueprintsTable.$inferSelect
export type BlueprintInsert = typeof blueprintsTable.$inferInsert
