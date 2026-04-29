import { Hono } from "hono"
import type { Logger } from "pino"

import type { Auth } from "@/auth"
import { createErrorHandler } from "@/middleware/ErrorHandler"
import { requestIdMiddleware } from "@/middleware/RequestId"
import { healthRoute } from "@/routes/Health"
import { buildAuthRoute } from "@/routes/Auth"

/**
 * Build the Hono application. Side-effect-free; ready to be served by
 * `@hono/node-server` or invoked in tests.
 */
export const createApp = (params: { auth: Auth; logger: Logger }) => {
  const { auth, logger } = params

  const app = new Hono()
    .use("*", requestIdMiddleware)
    .route("/health", healthRoute)
    .route("/auth", buildAuthRoute(auth))

  app.onError(createErrorHandler(logger))

  return app
}

/**
 * Resolved Hono app type. Exported so `@workspace/sdk` can consume it via
 * Hono RPC once routes start carrying typed request/response shapes.
 */
export type AppType = ReturnType<typeof createApp>
