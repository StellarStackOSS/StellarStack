import type { DaemonJwtScope } from "@workspace/shared/jwt.types"

/**
 * Server subuser row as returned by `/servers/:id/subusers`. Includes the
 * joined user identity columns so the UI can render an email + display
 * name without a second round-trip.
 */
export type SubuserRow = {
  id: string
  serverId: string
  userId: string
  email: string
  name: string | null
  permissions: DaemonJwtScope[]
  createdAt: string
}

/**
 * Body shape for `POST /servers/:id/subusers`. Email is the existing
 * account being granted access; the platform doesn't auto-create users.
 */
export type InviteSubuserRequest = {
  email: string
  permissions: DaemonJwtScope[]
}

/**
 * Body shape for `PATCH /servers/:id/subusers/:subId` — replaces the
 * stored permission set.
 */
export type UpdateSubuserRequest = {
  permissions: DaemonJwtScope[]
}
