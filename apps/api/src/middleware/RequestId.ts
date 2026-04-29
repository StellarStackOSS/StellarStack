import { randomUUID } from "node:crypto"

import { createMiddleware } from "hono/factory"

const HEADER = "x-request-id"

/**
 * Hono context variables shared across the API. Routes that consume
 * `c.get("requestId")` should type their Hono root with this so it remains
 * a `string` (no `unknown` casts).
 */
export type ApiVariables = {
  requestId: string
}

/**
 * Attach a request id to every request. Honors a client-supplied
 * `X-Request-ID` (useful for tracing across services) or generates a fresh
 * UUID. Available downstream via `c.get("requestId")` and echoed in the
 * response header so log correlation works end to end.
 */
export const requestIdMiddleware = createMiddleware<{
  Variables: ApiVariables
}>(async (c, next) => {
  const incoming = c.req.header(HEADER)
  const requestId =
    incoming !== undefined && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : randomUUID()
  c.set("requestId", requestId)
  c.header(HEADER, requestId)
  await next()
})
