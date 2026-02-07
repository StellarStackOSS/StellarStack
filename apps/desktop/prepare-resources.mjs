/**
 * Copies API bundle, Prisma files, and Prisma CLI into src-tauri/resources/.
 * The web frontend runs via `next start` from its own directory,
 * so it doesn't need to be copied here.
 */

import { cpSync, mkdirSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourceDir = join(__dirname, "src-tauri", "resources");

// Resolve packages from the API workspace (follows pnpm symlinks)
const apiRequire = createRequire(join(__dirname, "..", "api", "package.json"));

// Clean and recreate
if (existsSync(resourceDir)) {
  rmSync(resourceDir, { recursive: true });
}
mkdirSync(resourceDir, { recursive: true });

// 1. Copy API bundle → resources/api-bundle/
const apiBundle = join(__dirname, "..", "api", "dist", "api-bundle");
const apiDest = join(resourceDir, "api-bundle");
if (existsSync(apiBundle)) {
  console.log("[prepare] Copying API bundle...");
  cpSync(apiBundle, apiDest, { recursive: true });
} else {
  console.error("[prepare] ERROR: apps/api/dist/api-bundle/ not found. Run 'node apps/api/build-desktop.mjs' first.");
  process.exit(1);
}

// 2. Copy Prisma schema + migrations → resources/prisma/
const prismaDir = join(__dirname, "..", "api", "prisma");
const prismaDest = join(resourceDir, "prisma");
if (existsSync(prismaDir)) {
  console.log("[prepare] Copying Prisma files...");
  mkdirSync(prismaDest, { recursive: true });

  const schema = join(prismaDir, "schema.prisma");
  if (existsSync(schema)) {
    cpSync(schema, join(prismaDest, "schema.prisma"));
  }

  const migrations = join(prismaDir, "migrations");
  if (existsSync(migrations)) {
    cpSync(migrations, join(prismaDest, "migrations"), { recursive: true });
  }
} else {
  console.warn("[prepare] WARNING: apps/api/prisma/ not found, skipping.");
}

// 3. Copy Prisma CLI → resources/node_modules/prisma/
//    Required for `prisma migrate deploy` at runtime.
try {
  const prismaCliPkg = apiRequire.resolve("prisma/package.json");
  const prismaCliDir = dirname(prismaCliPkg);
  const prismaCliDest = join(resourceDir, "node_modules", "prisma");
  console.log("[prepare] Copying Prisma CLI from", prismaCliDir);
  cpSync(prismaCliDir, prismaCliDest, { recursive: true });
} catch (e) {
  console.error("[prepare] ERROR: Could not resolve prisma CLI package:", e.message);
  process.exit(1);
}

// 4. Copy @prisma/engines → resources/node_modules/@prisma/engines/
//    Contains the platform-specific schema engine binary for migrations.
try {
  const enginesPkg = apiRequire.resolve("@prisma/engines/package.json");
  const enginesDir = dirname(enginesPkg);
  const enginesDest = join(resourceDir, "node_modules", "@prisma", "engines");
  console.log("[prepare] Copying @prisma/engines from", enginesDir);
  cpSync(enginesDir, enginesDest, { recursive: true });
} catch (e) {
  console.warn("[prepare] WARNING: @prisma/engines not found, migrations may fail:", e.message);
}

console.log("[prepare] Done.");
