import type IORedis from "ioredis"
import { Hono } from "hono"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"

import type { Auth } from "@/auth"
import { createErrorHandler } from "@/middleware/ErrorHandler"
import { requestIdMiddleware, type ApiVariables } from "@/middleware/RequestId"
import { buildAuthRoute } from "@/routes/Auth"
import { healthRoute } from "@/routes/Health"
import { buildMeRoute } from "@/routes/Me"
import { buildReadyRoute } from "@/routes/Ready"

/**
 * Build the Hono application. Side-effect-free; ready to be served by
 * `@hono/node-server` or invoked in tests.
 */
export const createApp = (params: {
  auth: Auth
  db: Db
  redis: IORedis
  logger: Logger
}) => {
  const { auth, db, redis, logger } = params

  const app = new Hono<{ Variables: ApiVariables }>()
    .use("*", requestIdMiddleware)
    .route("/health", healthRoute)
    .route("/ready", buildReadyRoute({ db, redis }))
    .route("/auth", buildAuthRoute(auth))
    .route("/me", buildMeRoute({ auth, db }))

  app.onError(createErrorHandler(logger))

  return app
}

/**
 * Resolved Hono app type. Exported so `@workspace/sdk` can consume it via
 * Hono RPC once routes start carrying typed request/response shapes.
 */
export type AppType = ReturnType<typeof createApp>

/**
 * Re-export `ApiVariables` so route modules can import the context shape
 * from a single canonical location.
 */
export type { ApiVariables } from "@/middleware/RequestId"
