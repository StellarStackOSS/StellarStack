import { serve } from "@hono/node-server"
import IORedis from "ioredis"
import { Hono } from "hono"
import { isMemoryRedisUrl, MemoryRedis } from "@/lib/MemoryRedis"
import type { RedisLike } from "@/lib/StatusCache"
import { cors } from "hono/cors"
import pino from "pino"

import { createDb } from "@workspace/db/client"
import { ApiException } from "@workspace/shared/errors"

import { buildAuth } from "@/auth"
import { loadEnv } from "@/env"
import { seedDefaultBlueprintsIfEmpty } from "@/lib/DefaultBlueprints"
import { errorToResponse } from "@/lib/Errors"
import { InstallRunner } from "@/lib/InstallRunner"
import { maybeAutoMigrate } from "@/lib/Migrate"
import { Scheduler } from "@/lib/Scheduler"
import { StatusCache } from "@/lib/StatusCache"
import { requestIdMiddleware, type ApiVariables } from "@/middleware/RequestId"
import { buildActivityRoute } from "@/routes/Activity"
import { buildCrashesRoute } from "@/routes/Crashes"
import { buildAdminAuditRoute } from "@/routes/AdminAudit"
import { buildAdminServersRoute } from "@/routes/AdminServers"
import { buildAdminUsersRoute } from "@/routes/AdminUsers"
import { buildServerAllocationsRoute } from "@/routes/Allocations"
import { buildBackupsRoute } from "@/routes/Backups"
import { buildBlueprintsRoute } from "@/routes/Blueprints"
import { buildInstancesRoute } from "@/routes/Instances"
import { buildSchedulesRoute } from "@/routes/Schedules"
import { buildSubusersRoute } from "@/routes/Subusers"
import { buildTransfersRoute } from "@/routes/Transfers"
import { buildMeRoute } from "@/routes/Me"
import {
  buildNodesRoute,
  buildPairingExchangeRoute,
} from "@/routes/Nodes"
import { buildAdminDatabaseHostsRoute } from "@/routes/AdminDatabaseHosts"
import { buildConsoleAiRoute } from "@/routes/ConsoleAi"
import { buildDatabasesRoute } from "@/routes/Databases"
import { buildRemoteRoute } from "@/routes/Remote"
import { buildServersRoute } from "@/routes/Servers"
import { buildSetupRoute } from "@/routes/Setup"

const env = loadEnv()
const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    process.env["NODE_ENV"] === "production"
      ? undefined
      : { target: "pino-pretty" },
})

const db = createDb({ url: env.DATABASE_URL })

// Pick a Redis client based on REDIS_URL. The desktop app sets
// `memory://` so it doesn't need to run a Redis container alongside the
// already-required Postgres one. Real deploys keep using ioredis.
//
// `as unknown as RedisLike` because ioredis's `.set` has a fistful of
// overloads that don't structurally match RedisLike, even though both
// libraries handle the (key, value, "EX", ttl) call identically at
// runtime. RedisLike is the contract StatusCache needs; both clients
// honour it.
const redis: RedisLike = isMemoryRedisUrl(env.REDIS_URL)
  ? new MemoryRedis()
  : (new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    }) as unknown as RedisLike)

// Run pending migrations before anything else touches the schema. No-op
// in hosted mode (`STELLAR_AUTO_MIGRATE_PATH` is unset there).
await maybeAutoMigrate({
  db,
  migrationsFolder: env.STELLAR_AUTO_MIGRATE_PATH,
  log: logger,
})

const auth = buildAuth({ db, env })
const statusCache = new StatusCache(redis)
const installRunner = new InstallRunner(db)
const scheduler = new Scheduler(db, statusCache)
scheduler.start()

if (process.env["STELLAR_DESKTOP"] === "1") {
  await seedDefaultBlueprintsIfEmpty(db)
}

const app = new Hono<{ Variables: ApiVariables }>()

const corsOrigins = [env.APP_BASE_URL]
if (process.env["STELLAR_DESKTOP"] === "1") {
  // Dev: panel served by Vite at :5173. Packaged: panel served from
  // stellar://panel/... via the Electron custom protocol.
  corsOrigins.push("http://localhost:5173", "stellar://panel")
}
app.use("*", cors({
  origin: corsOrigins,
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

// Block self-registration at the HTTP layer. Server-side
// `auth.api.signUpEmail` (used by /api/setup) bypasses this because it
// doesn't go through the HTTP handler. New accounts only ever get
// created via the desktop onboarding flow or the admin invite path.
app.post("/auth/sign-up/email", (c) =>
  c.json({ message: "Self-registration is disabled" }, 404)
)

app.on(["GET", "POST", "PUT", "DELETE"], "/auth/*", async (c) => {
  const res = await auth.handler(c.req.raw)
  // In desktop mode, rewrite SameSite=Lax → SameSite=None so cookies
  // survive cross-origin fetches from stellar://panel back to
  // http://localhost:18080. Browsers drop Lax cookies on cross-site
  // subresource requests, which leaves the panel signed-out
  // immediately after sign-in. Secure flag is removed because the
  // URL is plain http://localhost.
  if (process.env["STELLAR_DESKTOP"] !== "1") return res
  const cookies = res.headers.getSetCookie?.() ?? []
  if (cookies.length === 0) return res
  const next = new Headers(res.headers)
  next.delete("set-cookie")
  for (const raw of cookies) {
    let rewritten = raw.replace(/;\s*SameSite=[^;]*/gi, "")
    // Chromium requires SameSite=None to be paired with Secure or it
    // silently drops the cookie. Localhost is treated as a secure
    // origin for cookie purposes, so Secure works fine on http://.
    if (!/;\s*Secure(?=;|$)/i.test(rewritten)) rewritten += "; Secure"
    rewritten += "; SameSite=None"
    next.append("set-cookie", rewritten)
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: next,
  })
})

app.route("/api/setup", buildSetupRoute({ auth, db, env }))
app.route("/api/me", buildMeRoute(auth, db))
app.route(
  "/api/servers",
  buildServersRoute({ auth, db, env, installRunner, statusCache })
)
app.route("/api/admin/audit", buildAdminAuditRoute({ auth, db }))
app.route("/api/admin/nodes", buildNodesRoute({ auth, db }))
app.route(
  "/api/admin/servers",
  buildAdminServersRoute({ auth, db, installRunner, statusCache })
)
app.route("/api/admin/users", buildAdminUsersRoute({ auth, db }))
app.route("/api/admin/blueprints", buildBlueprintsRoute({ auth, db }))
app.route(
  "/api/admin/database-hosts",
  buildAdminDatabaseHostsRoute({ auth, db, env })
)
app.route("/api/servers", buildBackupsRoute({ auth, db }))
app.route("/api/servers", buildServerAllocationsRoute({ auth, db }))
app.route("/api/servers", buildSubusersRoute({ auth, db }))
app.route("/api/servers", buildActivityRoute({ auth, db }))
app.route("/api/servers", buildCrashesRoute({ auth, db }))
app.route("/api/servers", buildSchedulesRoute({ auth, db }))
app.route("/api/servers", buildTransfersRoute({ auth, db }))
app.route("/api/servers", buildInstancesRoute({ auth, db, installRunner }))
app.route("/api/servers", buildConsoleAiRoute({ auth, db, env }))
app.route("/api/servers", buildDatabasesRoute({ auth, db, env }))
app.route("/api/remote", buildRemoteRoute({ db, env, statusCache }))
app.route("/api/nodes/pair", buildPairingExchangeRoute({ db }))

serve({ fetch: app.fetch, port: env.PORT })
logger.info({ port: env.PORT }, "api listening")
