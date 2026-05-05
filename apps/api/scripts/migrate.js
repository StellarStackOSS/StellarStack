#!/usr/bin/env node
/**
 * One-shot migration runner. The installer calls this inside the API
 * container before bringing the rest of the stack up:
 *
 *   docker compose run --rm api node scripts/migrate.js
 *
 * Reads DATABASE_URL from the environment, runs every pending Drizzle
 * migration in /app/drizzle, exits 0 on success or non-zero on failure.
 */

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set; refusing to run migrations.")
  process.exit(1)
}

const client = postgres(url, { max: 1 })
const db = drizzle(client)

try {
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("[migrate] all migrations applied")
} catch (err) {
  console.error("[migrate] failed:", err)
  process.exit(1)
} finally {
  await client.end()
}
