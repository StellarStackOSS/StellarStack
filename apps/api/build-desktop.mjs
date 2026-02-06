/**
 * Bundles the API into a single CJS file for the desktop app.
 *
 * Usage: node apps/api/build-desktop.mjs
 *
 * Output: apps/api/dist/api-bundle/api-bundle.cjs
 *
 * Prisma schema and migrations are NOT copied here — they live in
 * apps/api/prisma/ (the single source of truth) and are copied once
 * by prepare-resources.mjs during production builds.
 */

import { build } from "esbuild";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "dist", "api-bundle");

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

console.log("[build-desktop] Bundling API...");

await build({
  entryPoints: [join(__dirname, "src", "index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: join(outDir, "api-bundle.cjs"),
  // Keep Prisma client external — it relies on native query engine binaries
  external: ["@prisma/client", "prisma", "bcrypt"],
  sourcemap: false,
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("[build-desktop] Bundle written to dist/api-bundle/api-bundle.cjs");
console.log("[build-desktop] Done.");
