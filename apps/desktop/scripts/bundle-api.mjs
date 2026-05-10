// esbuild the API into a single CommonJS file the Electron main process
// can spawn as a sidecar. We don't ship a node_modules tree with the
// installer — instead, everything the API touches at runtime gets
// inlined here. A few packages (better-auth, drizzle-orm, postgres)
// have native bindings or top-level `require()`s that fail when fully
// bundled; those stay external and we copy a curated node_modules
// alongside.

import { build } from "esbuild"
import { cpSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(here, "..")
const repoRoot = resolve(desktopRoot, "..", "..")
const apiRoot = join(repoRoot, "apps", "api")
const out = join(desktopRoot, "build", "api")

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

await build({
  entryPoints: [join(apiRoot, "src", "main.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: join(out, "main.cjs"),
  // Drizzle, postgres, ioredis, better-auth and pino-pretty all use
  // dynamic require / native bindings that hate being bundled. Mark them
  // external and lean on the resolved node_modules at runtime.
  external: [
    "drizzle-orm",
    "postgres",
    "ioredis",
    "better-auth",
    "@hono/node-server",
    "pino",
    "pino-pretty",
  ],
  sourcemap: false,
  logLevel: "info",
})

// Copy the unbundled-but-required packages alongside main.cjs. electron-
// builder will then ship `resources/api/` containing main.cjs +
// node_modules/ to the user's machine.
const modules = [
  "drizzle-orm",
  "postgres",
  "ioredis",
  "better-auth",
  "@hono/node-server",
  "hono",
  "pino",
  "pino-pretty",
  "zod",
  "@workspace/db",
  "@workspace/shared",
]

mkdirSync(join(out, "node_modules"), { recursive: true })
for (const mod of modules) {
  const src = join(repoRoot, "node_modules", mod)
  const dest = join(out, "node_modules", mod)
  try {
    cpSync(src, dest, { recursive: true, dereference: true })
    console.log(`copied ${mod}`)
  } catch (err) {
    console.warn(`could not copy ${mod}:`, err.message)
  }
}
