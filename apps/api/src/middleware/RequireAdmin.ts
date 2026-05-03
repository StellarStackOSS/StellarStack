import { createMiddleware } from "hono/factory"

import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { AuthVariables } from "@/middleware/RequireSession"
import { buildRequireSession } from "@/middleware/RequireSession"

/**
 * Require an admin session. Composes RequireSession + a flag check so
 * admin handlers don't have to repeat both.
 */
export const buildRequireAdmin = (auth: Auth) => {
  const requireSession = buildRequireSession(auth)
  return [
    requireSession,
    createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
      const user = c.get("user")
      if (user.isAdmin !== true) {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      await next()
    }),
  ] as const
}
