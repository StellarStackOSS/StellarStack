/**
 * Copies API bundle and Prisma files into src-tauri/resources/.
 * The web frontend runs via `next start` from its own directory,
 * so it doesn't need to be copied here.
 */

import { cpSync, mkdirSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourceDir = join(__dirname, "src-tauri", "resources");

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

console.log("[prepare] Done.");
