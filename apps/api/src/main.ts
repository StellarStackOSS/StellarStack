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
import { buildMeRoute } from "@/routes/Me"
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
void installRunner // surfaced via routes in a later phase

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

app.route("/me", buildMeRoute(auth))
app.route("/servers", buildServersRoute({ auth, db, env, statusCache }))
app.route("/api/remote", buildRemoteRoute({ db, env, statusCache }))

serve({ fetch: app.fetch, port: env.PORT })
logger.info({ port: env.PORT }, "api listening")
