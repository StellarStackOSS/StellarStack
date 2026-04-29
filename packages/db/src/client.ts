import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { schema } from "@workspace/db/schema"
import type { Db } from "@workspace/db/client.types"

/**
 * Configuration accepted by `createDb`.
 */
export type CreateDbOptions = {
  url: string
  /**
   * Maximum connections in the postgres-js pool. Defaults to 10 — increase
   * for the worker process where many concurrent jobs run.
   */
  maxConnections?: number
}

/**
 * Build a Drizzle client bound to the StellarStack schema. Each long-lived
 * service (api, worker) creates one of these at boot and reuses it for the
 * process lifetime.
 */
export const createDb = (options: CreateDbOptions): Db => {
  const sql = postgres(options.url, {
    max: options.maxConnections ?? 10,
    prepare: false,
  })
  return drizzle(sql, { schema, casing: "snake_case" })
}
