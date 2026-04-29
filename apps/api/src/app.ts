import type IORedis from "ioredis"
import type { NodeWebSocket } from "@hono/node-ws"
import { Hono } from "hono"
import { cors } from "hono/cors"
import type { Logger } from "pino"

import type { Db } from "@workspace/db/client.types"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import { createErrorHandler } from "@/middleware/ErrorHandler"
import { requestIdMiddleware, type ApiVariables } from "@/middleware/RequestId"
import { buildAdminRoute } from "@/routes/Admin"
import { buildAuthRoute } from "@/routes/Auth"
import { buildBackupsRoute } from "@/routes/Backups"
import { buildDaemonPairRoute } from "@/routes/DaemonPair"
import { buildDaemonWsRoute } from "@/routes/DaemonWs"
import { buildEventsRoute } from "@/routes/Events"
import { healthRoute } from "@/routes/Health"
import { buildMeRoute } from "@/routes/Me"
import { buildReadyRoute } from "@/routes/Ready"
import { buildServersRoute } from "@/routes/Servers"
import type { Queues } from "@/queues"

/**
 * Build the Hono application without WebSocket-bearing routes. Side-effect
 * free; ready to be served by `@hono/node-server` or invoked in tests. The
 * returned app is then handed to `createNodeWebSocket` so the WS upgrade
 * helper can be derived; once that helper exists, call
 * `attachWebSocketRoutes` to mount routes that need it.
 */
export const createApp = (params: {
  auth: Auth
  db: Db
  env: Env
  logger: Logger
  queues: Queues
  redis: IORedis
}) => {
  const { auth, db, env, logger, queues, redis } = params

  const app = new Hono<{ Variables: ApiVariables }>()
    .use(
      "*",
      cors({
        origin: env.PUBLIC_APP_URL,
        credentials: true,
        allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
        allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      })
    )
    .use("*", requestIdMiddleware)
    .route("/health", healthRoute)
    .route("/ready", buildReadyRoute({ db, redis }))
    .route("/auth", buildAuthRoute(auth))
    .route("/me", buildMeRoute({ auth, db }))
    .route("/admin", buildAdminRoute({ auth, db, env, queues }))
    .route("/servers", buildServersRoute({ auth, db, queues }))
    .route("/servers", buildBackupsRoute({ auth, db, queues }))
    .route("/daemon/pair", buildDaemonPairRoute({ db, env }))

  app.onError(createErrorHandler(logger))

  return app
}

/**
 * Mount routes that need the WebSocket upgrade helper. Called from `main.ts`
 * after `createNodeWebSocket(app)` has produced the helper.
 */
export const attachWebSocketRoutes = (
  app: ReturnType<typeof createApp>,
  params: {
    auth: Auth
    db: Db
    env: Env
    logger: Logger
    redis: IORedis
    upgradeWebSocket: NodeWebSocket["upgradeWebSocket"]
  }
): void => {
  app.route(
    "/events",
    buildEventsRoute({
      auth: params.auth,
      env: params.env,
      logger: params.logger,
      upgradeWebSocket: params.upgradeWebSocket,
    })
  )
  app.route(
    "/daemon/ws",
    buildDaemonWsRoute({
      db: params.db,
      env: params.env,
      logger: params.logger,
      redis: params.redis,
      upgradeWebSocket: params.upgradeWebSocket,
    })
  )
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
