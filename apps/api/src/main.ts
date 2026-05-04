import { serve } from "@hono/node-server"
import IORedis from "ioredis"
import { Hono } from "hono"
import { cors } from "hono/cors"
import pino from "pino"

import { createDb } from "@workspace/db/client"
import { ApiException } from "@workspace/shared/errors"

import { buildAuth } from "@/auth"
import { loadEnv } from "@/env"
import { errorToResponse } from "@/lib/Errors"
import { InstallRunner } from "@/lib/InstallRunner"
import { StatusCache } from "@/lib/StatusCache"
import { requestIdMiddleware, type ApiVariables } from "@/middleware/RequestId"
import { buildActivityRoute } from "@/routes/Activity"
import { buildAdminAuditRoute } from "@/routes/AdminAudit"
import { buildAdminServersRoute } from "@/routes/AdminServers"
import { buildAdminUsersRoute } from "@/routes/AdminUsers"
import { buildServerAllocationsRoute } from "@/routes/Allocations"
import { buildBackupsRoute } from "@/routes/Backups"
import { buildBlueprintsRoute } from "@/routes/Blueprints"
import { buildSchedulesRoute } from "@/routes/Schedules"
import { buildSubusersRoute } from "@/routes/Subusers"
import { buildTransfersRoute } from "@/routes/Transfers"
import { buildMeRoute } from "@/routes/Me"
import {
  buildNodesRoute,
  buildPairingExchangeRoute,
} from "@/routes/Nodes"
import { buildRemoteRoute } from "@/routes/Remote"
import { buildServersRoute } from "@/routes/Servers"

const env = loadEnv()
const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    process.env["NODE_ENV"] === "production"
      ? undefined
      : { target: "pino-pretty" },
})

const db = createDb({ url: env.DATABASE_URL })
const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
const auth = buildAuth({ db, env })
const statusCache = new StatusCache(redis)
const installRunner = new InstallRunner(db)

const app = new Hono<{ Variables: ApiVariables }>()

app.use("*", cors({
  origin: [env.APP_BASE_URL],
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposeHeaders: ["X-Request-Id"],
}))
app.use("*", requestIdMiddleware)

app.onError((err, c) => {
  if (!(err instanceof ApiException)) {
    logger.error({ err, requestId: c.get("requestId") }, "unhandled error")
  }
  return errorToResponse(c, err)
})

app.on(["GET", "POST", "PUT", "DELETE"], "/auth/*", (c) =>
  auth.handler(c.req.raw)
)

app.route("/me", buildMeRoute(auth, db))
app.route(
  "/servers",
  buildServersRoute({ auth, db, env, installRunner, statusCache })
)
app.route("/admin/audit", buildAdminAuditRoute({ auth, db }))
app.route("/admin/nodes", buildNodesRoute({ auth, db }))
app.route(
  "/admin/servers",
  buildAdminServersRoute({ auth, db, installRunner, statusCache })
)
app.route("/admin/users", buildAdminUsersRoute({ auth, db }))
// Blueprints are visible to any signed-in user (server creation needs to
// list them) but mutations require admin. The route enforces this via
// a layered middleware chain inside buildBlueprintsRoute.
app.route("/admin/blueprints", buildBlueprintsRoute({ auth, db }))
app.route("/backups", buildBackupsRoute({ auth, db }))
// Sibling-mount of allocation handlers: their paths start with
// /:serverId/allocations[...] which doesn't collide with any existing
// `/servers/:id/...` handler in buildServersRoute.
app.route("/servers", buildServerAllocationsRoute({ auth, db }))
app.route("/servers", buildSubusersRoute({ auth, db }))
app.route("/servers", buildActivityRoute({ auth, db }))
app.route("/servers", buildSchedulesRoute({ auth, db }))
app.route("/servers", buildTransfersRoute({ auth, db }))
app.route("/api/remote", buildRemoteRoute({ db, env, statusCache }))
app.route("/api/nodes/pair", buildPairingExchangeRoute({ db }))

serve({ fetch: app.fetch, port: env.PORT })
logger.info({ port: env.PORT }, "api listening")
