import * as auth from "@workspace/db/schema/auth"
import * as nodes from "@workspace/db/schema/nodes"
import * as blueprints from "@workspace/db/schema/blueprints"
import * as servers from "@workspace/db/schema/servers"
import * as backups from "@workspace/db/schema/backups"
import * as schedules from "@workspace/db/schema/schedules"
import * as audit from "@workspace/db/schema/audit"
import * as jobs from "@workspace/db/schema/jobs"

/**
 * Aggregate schema object passed to `drizzle()`. Application code should not
 * import symbols from here — import from the per-domain modules
 * (`@workspace/db/schema/servers`, etc.). This file exists solely so the
 * Drizzle client and drizzle-kit see every table.
 */
export const schema = {
  ...auth,
  ...nodes,
  ...blueprints,
  ...servers,
  ...backups,
  ...schedules,
  ...audit,
  ...jobs,
}
