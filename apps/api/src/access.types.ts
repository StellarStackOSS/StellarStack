import type { ServerRow } from "@workspace/db/schema/servers"
import type { DaemonJwtScope } from "@workspace/shared/jwt.types"

/**
 * Result of `loadServerAccess`. `role` indicates how the caller earned
 * the access; `permissions` is the effective scope set the caller may
 * exercise on this server (owners + admins implicitly hold every scope).
 */
export type ServerAccess = {
  server: ServerRow
  role: "owner" | "admin" | "subuser"
  permissions: DaemonJwtScope[]
}
