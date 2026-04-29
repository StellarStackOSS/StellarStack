import { createMiddleware } from "hono/factory"

import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { ApiVariables } from "@/middleware/RequestId"

type AuthSession = Awaited<ReturnType<Auth["api"]["getSession"]>>
type AuthSessionPayload = NonNullable<AuthSession>

/**
 * Hono variables added to the context after a successful session check.
 */
export type AuthVariables = ApiVariables & {
  user: AuthSessionPayload["user"]
  session: AuthSessionPayload["session"]
}

/**
 * Middleware that loads the better-auth session for the request. Throws
 * `ApiException("auth.session.invalid")` with status 401 when no session is
 * present, so the global error handler renders the canonical envelope.
 */
export const buildRequireSession = (auth: Auth) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (session === null) {
      throw new ApiException("auth.session.invalid", { status: 401 })
    }
    c.set("user", session.user)
    c.set("session", session.session)
    await next()
  })
