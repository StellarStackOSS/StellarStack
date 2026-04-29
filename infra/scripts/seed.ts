import { eq, sql } from "drizzle-orm"

import { createDb } from "@workspace/db/client"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { blueprintSchema } from "@workspace/shared/blueprint"
import type { Blueprint } from "@workspace/shared/blueprint.types"

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL must be set when running the seed script")
}

const db = createDb({ url: databaseUrl })

const minecraftBlueprint: Blueprint = {
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
      name: { key: "blueprint.minecraft.variables.jar.name" },
      description: { key: "blueprint.minecraft.variables.jar.description" },
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
            pattern:
              "^\\[..:..:..\\] \\[Server thread/INFO\\]: Done \\(.+\\)!",
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
  features: ["eula", "java_version_picker"],
}

const upsertBlueprint = async (blueprint: Blueprint): Promise<string> => {
  const validated = blueprintSchema.parse(blueprint)
  const displayName =
    typeof validated.name === "string" ? validated.name : validated.name.key
  const existing = await db
    .select({ id: blueprintsTable.id })
    .from(blueprintsTable)
    .where(sql`${blueprintsTable.name}->>'key' = ${displayName} or ${blueprintsTable.name} = to_jsonb(${displayName}::text)`)
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
    throw new Error("Insert returned no row")
  }
  return row.id
}

const main = async () => {
  const id = await upsertBlueprint(minecraftBlueprint)
  console.log(`Seeded Minecraft blueprint: ${id}`)
}

main()
  .catch((err) => {
    console.error("Seed failed", err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
