import { count, eq, sql } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { blueprintSchema } from "@workspace/shared/blueprint"
import type { Blueprint } from "@workspace/shared/blueprint.types"

/**
 * Default Minecraft Paper blueprint, seeded on first launch of the
 * desktop app so the user has something to install without first
 * importing a catalog. Mirrors the definition in `infra/scripts/seed.ts`
 * but stays local to the API so the desktop bundle doesn't need to pull
 * the seed script in.
 */
export const MINECRAFT_PAPER: Blueprint = {
  schemaVersion: 1,
  name: "Minecraft (Paper)",
  description:
    "A high-performance Minecraft server based on Paper. Variables expose the jar filename, EULA acceptance, and JVM heap.",
  author: "stellarstack",
  dockerImages: {
    "Java 21": "ghcr.io/stellarstack/java:21",
    "Java 17": "ghcr.io/stellarstack/java:17",
  },
  stopSignal: "^stop",
  startupCommand:
    "java -Xms{{SERVER_MEMORY}}M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
  configFiles: [
    {
      path: "server.properties",
      parser: "properties",
      patches: { "server-port": "{{SERVER_PORT}}" },
    },
  ],
  variables: [
    {
      key: "SERVER_JARFILE",
      name: "Server JAR filename",
      default: "server.jar",
      userViewable: true,
      userEditable: true,
      rules: "required|string|max:32",
    },
    {
      key: "SERVER_MEMORY",
      name: "Memory (MB)",
      default: "1024",
      userViewable: true,
      userEditable: false,
      rules: "required|number|min:128",
    },
    {
      key: "EULA",
      name: "Accept EULA",
      default: "true",
      userViewable: true,
      userEditable: true,
      rules: "required|boolean",
    },
  ],
  install: {
    image: "ghcr.io/stellarstack/installers:debian",
    entrypoint: "bash",
    script:
      "#!/usr/bin/env bash\nset -euo pipefail\necho 'paper installer placeholder'\n",
  },
  lifecycle: {
    starting: {
      probes: [
        {
          strategy: "console",
          match: {
            type: "regex",
            pattern: "Done \\(.+\\)! For help",
          },
        },
      ],
      intervalMs: 2_000,
      timeoutMs: 120_000,
      onTimeout: "mark_crashed",
    },
    stopping: {
      probes: [{ strategy: "container_exit" }],
      graceTimeoutMs: 60_000,
      onTimeout: "force_kill",
    },
    crashDetection: {
      probes: [
        {
          strategy: "container_exit",
          ifNotInState: ["stopping", "stopped"],
        },
        {
          strategy: "console",
          match: { type: "regex", pattern: "^FATAL ERROR" },
        },
      ],
    },
  },
  features: { eula: [], java_version_picker: [] },
}

/**
 * Insert the default blueprints into an empty catalog. No-op if the
 * `blueprints` table already has any rows — operators who manually
 * imported their own catalog don't get duplicates.
 */
export const seedDefaultBlueprintsIfEmpty = async (db: Db): Promise<void> => {
  const [row] = await db.select({ value: count() }).from(blueprintsTable)
  if ((row?.value ?? 0) > 0) return
  await upsertBlueprint(db, MINECRAFT_PAPER)
}

const upsertBlueprint = async (
  db: Db,
  blueprint: Blueprint
): Promise<string> => {
  const validated = blueprintSchema.parse(blueprint)
  const displayName =
    typeof validated.name === "string" ? validated.name : validated.name.key
  const existing = await db
    .select({ id: blueprintsTable.id })
    .from(blueprintsTable)
    .where(
      sql`${blueprintsTable.name}->>'key' = ${displayName} or ${blueprintsTable.name} = to_jsonb(${displayName}::text)`
    )
    .limit(1)

  const values = {
    schemaVersion: String(validated.schemaVersion),
    name: validated.name,
    description: validated.description ?? null,
    author: validated.author ?? null,
    dockerImages: validated.dockerImages,
    stopSignal: validated.stopSignal,
    startupCommand: validated.startupCommand,
    configFiles: validated.configFiles ?? null,
    variables: validated.variables,
    installImage: validated.install.image,
    installEntrypoint: validated.install.entrypoint,
    installScript: validated.install.script,
    lifecycle: validated.lifecycle,
    features: validated.features ?? null,
    updatedAt: new Date(),
  }

  const existingRow = existing[0]
  if (existingRow !== undefined) {
    await db
      .update(blueprintsTable)
      .set(values)
      .where(eq(blueprintsTable.id, existingRow.id))
    return existingRow.id
  }
  const inserted = await db
    .insert(blueprintsTable)
    .values(values)
    .returning({ id: blueprintsTable.id })
  const row = inserted[0]
  if (row === undefined) {
    throw new Error("Blueprint insert returned no row")
  }
  return row.id
}
