import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { schema } from "@workspace/db/schema"

/**
 * Drizzle database handle bound to the StellarStack schema. Pass this around
 * inside services rather than reconstructing per-call.
 */
export type Db = PostgresJsDatabase<typeof schema>
