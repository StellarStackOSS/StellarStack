import { and, eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import {
  serverSubusersTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException } from "@workspace/shared/errors"
import type { DaemonJwtScope } from "@workspace/shared/jwt.types"
import { daemonJwtScopes } from "@workspace/shared/jwt"

import type { ServerAccess } from "@/access.types"

const ALL_SCOPES = daemonJwtScopes as readonly DaemonJwtScope[]

/**
 * Resolve the requesting user's relationship to a server: owner, admin
 * (panel-wide), or subuser. Throws `servers.not_found` for any other
 * caller. Owners and admins implicitly hold every scope; subusers carry
 * the explicit set persisted in `server_subusers.permissions`.
 *
 * Used by every server-scoped route to gate access uniformly.
 */
export const loadServerAccess = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<ServerAccess> => {
  const server = (
    await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (server === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }

  if (user.isAdmin === true) {
    return { server, role: "admin", permissions: [...ALL_SCOPES] }
  }

  if (server.ownerId === user.id) {
    return { server, role: "owner", permissions: [...ALL_SCOPES] }
  }

  const subuser = (
    await db
      .select()
      .from(serverSubusersTable)
      .where(
        and(
          eq(serverSubusersTable.serverId, serverId),
          eq(serverSubusersTable.userId, user.id)
        )
      )
      .limit(1)
  )[0]
  if (subuser === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  const valid = subuser.permissions.filter((s): s is DaemonJwtScope =>
    (ALL_SCOPES as readonly string[]).includes(s)
  )
  return { server, role: "subuser", permissions: valid }
}

/**
 * Throw `permissions.denied` (with the offending scope as a param) if
 * `access.permissions` doesn't include `requiredScope`.
 */
export const requireScope = (
  access: ServerAccess,
  requiredScope: DaemonJwtScope
): void => {
  if (!access.permissions.includes(requiredScope)) {
    throw new ApiException("permissions.denied", {
      status: 403,
      params: { statement: requiredScope },
    })
  }
}

/**
 * Filter `requested` down to the subset the caller is actually allowed
 * to receive. Used by ws/files/sftp credential mints so a subuser only
 * gets a JWT with scopes they hold.
 */
export const filterScopes = (
  access: ServerAccess,
  requested: DaemonJwtScope[]
): DaemonJwtScope[] =>
  requested.filter((scope) => access.permissions.includes(scope))
