import { randomUUID } from "node:crypto"

import { createMiddleware } from "hono/factory"

export type ApiVariables = {
  requestId: string
}

/**
 * Tags every request with a UUID for correlated logging. Pulled from the
 * `X-Request-Id` header when the caller supplies one, otherwise generated.
 */
export const requestIdMiddleware = createMiddleware<{ Variables: ApiVariables }>(
  async (c, next) => {
    const fromHeader = c.req.header("X-Request-Id")
    const id = fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID()
    c.set("requestId", id)
    c.header("X-Request-Id", id)
    await next()
  }
)
