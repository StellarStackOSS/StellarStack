// Build the panel UI with the URLs the desktop app actually serves on,
// then copy the dist into `apps/desktop/build/web/` so electron-builder
// ships it as `resources/panel/`.
//
// We rebuild rather than reuse `apps/web/dist` because the panel's API
// + WS URLs are inlined at build time (Vite's `VITE_*` are static). The
// hosted product builds with no `VITE_API_URL` (same-origin); the
// desktop install needs them pinned to `http://localhost:<apiPort>`.

import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(here, "..")
const repoRoot = resolve(desktopRoot, "..", "..")
const webRoot = join(repoRoot, "apps", "web")
const out = join(desktopRoot, "build", "web")

// These mirror `apps/desktop/src/main/env.ts` — keep in sync.
const API_PORT = 18080

const env = {
  ...process.env,
  VITE_API_URL: `http://localhost:${String(API_PORT)}`,
  VITE_WS_URL: `ws://localhost:${String(API_PORT)}`,
}

console.log("building panel with VITE_API_URL=" + env.VITE_API_URL)
// `shell: true` so we resolve pnpm.cmd via PATHEXT on Windows. Without
// it, spawnSync looks for a literal "pnpm" binary which doesn't exist
// on win32 (only pnpm.cmd / pnpm.ps1).
const result = spawnSync("pnpm", ["--filter", "web", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  env,
  shell: true,
})
if (result.status !== 0) {
  console.error("panel build failed")
  process.exit(result.status ?? 1)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(join(webRoot, "dist"), out, { recursive: true })
console.log(`copied panel build → ${out}`)
