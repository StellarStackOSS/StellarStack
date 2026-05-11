// Copies non-TS assets from `src/` into `dist/` after `tsc` runs.
// Today that's just the bootstrap HTML; if we ever ship icons or other
// static files that the main/preload code references at runtime, list
// them here.

import { cpSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const copies = [
  { from: "src/bootstrap", to: "dist/bootstrap" },
  { from: "src/onboarding", to: "dist/onboarding" },
]

for (const { from, to } of copies) {
  const src = join(root, from)
  const dest = join(root, to)
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`copy: ${from} → ${to}`)
}
