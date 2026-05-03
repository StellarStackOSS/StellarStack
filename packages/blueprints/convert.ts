#!/usr/bin/env tsx
/**
 * Egg-to-Blueprint converter
 *
 * Converts Pterodactyl PTDL_v2 egg JSON files into StellarStack blueprint
 * JSON files. Run against a single egg or a whole directory tree:
 *
 *   tsx packages/blueprints/convert.ts packages/blueprints/game-eggs/minecraft/java/paper/egg-paper.json
 *   tsx packages/blueprints/convert.ts packages/blueprints/game-eggs/  --out packages/blueprints/converted/
 *
 * Flags:
 *   --out <dir>    Output directory (default: packages/blueprints/converted)
 *   --dry-run      Print converted JSON to stdout; do not write files
 *   --validate     Run the blueprintSchema Zod parse after conversion and
 *                  print any validation errors (useful for debugging)
 */

import fs from "node:fs"
import path from "node:path"

import { blueprintSchema } from "@workspace/shared/blueprint"
import type {
  Blueprint,
  BlueprintConfigFile,
  BlueprintVariable,
} from "@workspace/shared/blueprint.types"

// ---------------------------------------------------------------------------
// Egg types (PTDL_v2)
// ---------------------------------------------------------------------------

type EggVariable = {
  name: string
  description: string
  env_variable: string
  default_value: string
  user_viewable: boolean
  user_editable: boolean
  rules: string
  field_type?: string
}

type Egg = {
  meta?: { version?: string }
  name: string
  author?: string
  description?: string
  features?: string[]
  docker_images?: Record<string, string>
  file_denylist?: string[]
  startup?: string
  config?: {
    files?: string
    startup?: string | { done?: string }
    logs?: string
    stop?: string
  }
  scripts?: {
    installation?: {
      script?: string
      container?: string
      entrypoint?: string
    }
  }
  variables?: EggVariable[]
}

// ---------------------------------------------------------------------------
// Field mapping helpers
// ---------------------------------------------------------------------------

/**
 * Pterodactyl config.files is a JSON string containing an object shaped:
 * { "<path>": { "parser": "...", "find": { "<key>": "<value>" } } }
 *
 * The "find" values can reference `{{server.build.default.port}}` which we
 * normalise to `{{SERVER_PORT}}`.
 */
const parseConfigFiles = (raw: string): BlueprintConfigFile[] => {
  let parsed: Record<
    string,
    { parser?: string; find?: Record<string, string> }
  >
  try {
    parsed = JSON.parse(raw) as typeof parsed
  } catch {
    return []
  }

  const SUPPORTED_PARSERS = new Set([
    "properties",
    "json",
    "yaml",
    "ini",
    "toml",
    "xml",
  ])

  return Object.entries(parsed).flatMap(([filePath, cfg]) => {
    const parser = cfg.parser ?? "properties"
    if (!SUPPORTED_PARSERS.has(parser)) {
      console.warn(
        `  ⚠ Unsupported config file parser "${parser}" for ${filePath} — skipping`
      )
      return []
    }
    const patches: Record<string, string> = {}
    for (const [key, value] of Object.entries(cfg.find ?? {})) {
      if (typeof value === "string") {
        patches[key] = normaliseVars(value)
      } else {
        patches[key] = normaliseVars(JSON.stringify(value))
      }
    }
    return [
      {
        path: filePath,
        parser: parser as BlueprintConfigFile["parser"],
        patches,
      },
    ]
  })
}

/**
 * Translate Pterodactyl's `{{server.build.default.port}}` placeholder to the
 * StellarStack convention `{{SERVER_PORT}}`. All other `{{VAR}}` tokens are
 * passed through unchanged since they already match the egg variable keys.
 */
const normaliseVars = (s: string): string =>
  s
    .replace(/\{\{server\.build\.default\.port\}\}/g, "{{SERVER_PORT}}")
    .replace(/\{\{server\.build\.node\.fqdn\}\}/g, "{{SERVER_FQDN}}")

/**
 * Parse the `config.startup` field — it may be a raw JSON string or already
 * an object with a `done` key indicating the "server is ready" substring.
 */
const parseDoneString = (raw: string | { done?: string } | undefined): string | null => {
  if (raw === undefined || raw === null) return null
  if (typeof raw === "object") return raw.done ?? null
  try {
    const parsed = JSON.parse(raw) as { done?: string }
    return parsed.done ?? null
  } catch {
    return null
  }
}

/**
 * Map Pterodactyl feature names to StellarStack equivalents. Unknown features
 * are forwarded as-is so custom daemons can still react to them.
 */
const mapFeature = (f: string): string => {
  const MAP: Record<string, string> = {
    java_version: "java_version_picker",
    pid_limit: "pid_limit",
    eula: "eula",
  }
  return MAP[f] ?? f
}

/**
 * Convert a single Pterodactyl PTDL_v2 egg object to a StellarStack blueprint.
 */
const convertEgg = (egg: Egg): Blueprint => {
  const stopSignal = egg.config?.stop ?? "^C"
  const startupCommand = normaliseVars(egg.startup ?? "")
  const dockerImages: Record<string, string> = {}

  for (const [label, image] of Object.entries(egg.docker_images ?? {})) {
    dockerImages[label] = image
  }

  if (Object.keys(dockerImages).length === 0) {
    console.warn("  ⚠ No docker_images found — using a placeholder")
    dockerImages["Default"] = "ghcr.io/stellarstack/base:latest"
  }

  const configFiles =
    egg.config?.files != null && egg.config.files.trim().length > 0 && egg.config.files.trim() !== "{}"
      ? parseConfigFiles(egg.config.files)
      : []

  const variables: BlueprintVariable[] = (egg.variables ?? []).map((v) => ({
    key: v.env_variable,
    name: v.name,
    description: v.description.trim().length > 0 ? v.description.replace(/\r\n/g, "\n").trim() : undefined,
    default: v.default_value,
    userViewable: v.user_viewable,
    userEditable: v.user_editable,
    rules: v.rules || "nullable|string",
  }))

  const doneString = parseDoneString(egg.config?.startup)

  const startingProbe =
    doneString != null
      ? { strategy: "console" as const, match: { type: "substring" as const, value: doneString } }
      : { strategy: "console" as const, match: { type: "substring" as const, value: "done" } }

  const install = egg.scripts?.installation
  const installBlock = {
    image: install?.container ?? "ghcr.io/ptero-eggs/installers:alpine",
    entrypoint: install?.entrypoint ?? "ash",
    script: (install?.script ?? "#!/bin/ash\necho 'No install script'").replace(/\r\n/g, "\n"),
  }

  const features = (egg.features ?? []).map(mapFeature)

  const blueprint: Blueprint = {
    schemaVersion: 1,
    name: egg.name,
    author: egg.author,
    description: egg.description?.trim().length ? egg.description.trim() : undefined,
    dockerImages,
    stopSignal,
    startupCommand,
    ...(configFiles.length > 0 ? { configFiles } : {}),
    variables,
    install: installBlock,
    lifecycle: {
      starting: {
        probes: [startingProbe],
        intervalMs: 2000,
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
        ],
      },
    },
    ...(features.length > 0 ? { features } : {}),
  }

  return blueprint
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const validate = args.includes("--validate")
const outIdx = args.indexOf("--out")
const outDir =
  outIdx !== -1
    ? args[outIdx + 1]
    : path.resolve(process.cwd(), "packages/blueprints/converted")

const outDirArg = outIdx !== -1 ? args[outIdx + 1] : undefined
const inputs = args.filter((a) => !a.startsWith("--") && a !== outDirArg)

if (inputs.length === 0) {
  console.error("Usage: tsx packages/blueprints/convert.ts <egg.json|dir> [--out <dir>] [--dry-run] [--validate]")
  process.exit(1)
}

const collectEggFiles = (target: string): string[] => {
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs
    .readdirSync(target, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".json") && path.basename(f).startsWith("egg-"))
    .map((f) => path.join(target, f))
}

const eggFiles = inputs.flatMap(collectEggFiles)

if (!dryRun && outDir !== undefined) {
  fs.mkdirSync(outDir, { recursive: true })
}

let ok = 0
let failed = 0

for (const eggFile of eggFiles) {
  const rel = path.relative(process.cwd(), eggFile)
  console.log(`\nConverting: ${rel}`)

  let egg: Egg
  try {
    egg = JSON.parse(fs.readFileSync(eggFile, "utf8")) as Egg
  } catch (e) {
    console.error(`  ✗ Failed to parse JSON: ${String(e)}`)
    failed++
    continue
  }

  if (egg.meta?.version !== "PTDL_v2") {
    console.warn(`  ⚠ meta.version is not PTDL_v2 — proceeding anyway`)
  }

  let blueprint: Blueprint
  try {
    blueprint = convertEgg(egg)
  } catch (e) {
    console.error(`  ✗ Conversion error: ${String(e)}`)
    failed++
    continue
  }

  if (validate) {
    const result = blueprintSchema.safeParse(blueprint)
    if (!result.success) {
      console.error("  ✗ Blueprint validation failed:")
      for (const issue of result.error.issues) {
        console.error(`    ${issue.path.join(".")} — ${issue.message}`)
      }
      failed++
      continue
    }
    console.log("  ✓ Passes blueprintSchema validation")
  }

  const json = JSON.stringify(blueprint, null, 2)

  if (dryRun) {
    console.log(json)
  } else if (outDir !== undefined) {
    const baseName = path
      .basename(eggFile, ".json")
      .replace(/^egg-/, "")
    const subPath = path
      .relative(
        path.resolve(process.cwd(), "packages/blueprints/game-eggs"),
        path.dirname(eggFile)
      )
      .replace(/\\/g, "/")

    const destDir = path.join(outDir, subPath)
    fs.mkdirSync(destDir, { recursive: true })
    const destFile = path.join(destDir, `${baseName}.blueprint.json`)
    fs.writeFileSync(destFile, json, "utf8")
    console.log(`  → ${path.relative(process.cwd(), destFile)}`)
  }

  ok++
}

console.log(`\nDone. ${ok} converted, ${failed} failed.`)
if (failed > 0) process.exit(1)
