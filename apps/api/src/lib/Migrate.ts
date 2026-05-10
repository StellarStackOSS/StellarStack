import { migrate as runMigrations } from "drizzle-orm/postgres-js/migrator"

import type { Db } from "@workspace/db/client.types"

/**
 * Apply pending migrations against the connected Postgres. Used by the
 * desktop app on first launch — the API process owns its database, so
 * having a `pnpm db:migrate` step in the user's flow is unacceptable.
 *
 * Hosted deploys still use the `db:migrate` command at deploy time and
 * skip this — pass `STELLAR_AUTO_MIGRATE` to opt in.
 */
export const maybeAutoMigrate = async (params: {
  db: Db
  migrationsFolder: string | undefined
  log: { info: (msg: string) => void; warn: (msg: string) => void }
}): Promise<void> => {
  const { db, migrationsFolder, log } = params
  if (migrationsFolder === undefined || migrationsFolder === "") {
    return
  }
  log.info(`auto-migrate: applying migrations from ${migrationsFolder}`)
  try {
    await runMigrations(db as never, { migrationsFolder })
    log.info("auto-migrate: complete")
  } catch (err) {
    log.warn(
      `auto-migrate: failed — ${err instanceof Error ? err.message : String(err)}`
    )
    throw err
  }
}
