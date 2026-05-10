// esbuild the API into a single ESM file the Electron main process can
// spawn as a sidecar. We don't ship a node_modules tree with the
// installer — instead, everything the API touches at runtime gets
// inlined here. A few packages (better-auth, drizzle-orm, postgres)
// have native bindings or top-level `require()`s that fail when fully
// bundled; those stay external and we copy a curated node_modules
// alongside.
//
// Output is `.mjs` because the API's `main.ts` uses top-level `await`
// (Drizzle migration runner) which esbuild only supports in ESM.

import { build } from "esbuild"
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
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
  format: "esm",
  outfile: join(out, "main.mjs"),
  // We deliberately bundle everything inline. Pino can be tricky
  // because it spawns worker threads for transports; we sidestep that
  // by setting the API's logger to use the no-transport path in
  // desktop mode (NODE_ENV=production avoids `pino-pretty`).
  external: [],
  // ESM imports of CommonJS packages need this banner so `require` is
  // available inside the bundle.
  banner: {
    js: `import { createRequire as __cr } from "module";\nconst require = __cr(import.meta.url);`,
  },
  sourcemap: false,
  logLevel: "info",
})

// Copy the drizzle migrations folder. The API auto-migrates on boot in
// desktop mode and reads SQL from this path (env STELLAR_AUTO_MIGRATE_PATH).
// electron-builder ships this as `resources/migrations/`.
const migrationsSrc = join(repoRoot, "packages", "db", "drizzle")
const migrationsDest = resolve(desktopRoot, "build", "migrations")
rmSync(migrationsDest, { recursive: true, force: true })
mkdirSync(migrationsDest, { recursive: true })
cpSync(migrationsSrc, migrationsDest, { recursive: true })
console.log(`copied migrations from ${migrationsSrc}`)

// Copy the unbundled-but-required packages alongside main.mjs. electron-
// builder will then ship `resources/api/` containing main.mjs +
// node_modules/ to the user's machine.
// Nothing externalised — empty. Kept the surrounding loop in case we
// need to selectively ship a native module later.
const modules = []

// Pnpm hoists workspace-shared deps into the repo root's node_modules
// but app-specific packages live under apps/api/node_modules. Search
// both — the api's local dir wins if both have the package.
mkdirSync(join(out, "node_modules"), { recursive: true })
const candidateRoots = [
  join(apiRoot, "node_modules"),
  join(repoRoot, "node_modules"),
]
for (const mod of modules) {
  let copied = false
  for (const root of candidateRoots) {
    const src = join(root, mod)
    const dest = join(out, "node_modules", mod)
    try {
      cpSync(src, dest, { recursive: true, dereference: true })
      console.log(`copied ${mod} from ${root}`)
      copied = true
      break
    } catch {
      // try next root
    }
  }
  if (!copied) {
    console.warn(`could not find ${mod} in any candidate root`)
  }
}

// Drop a `package.json` so Node treats main.mjs's `require` calls inside
// any future imports as ESM-aware. Marking type=module + main=main.mjs
// keeps the entrypoint stable.
writeFileSync(
  join(out, "package.json"),
  JSON.stringify(
    {
      name: "stellar-api-bundle",
      version: "0.0.0",
      private: true,
      type: "module",
      main: "main.mjs",
    },
    null,
    2
  )
)
