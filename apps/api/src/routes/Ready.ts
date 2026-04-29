import type IORedis from "ioredis"
import { Hono } from "hono"
import { sql } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { ApiException, serializeApiException } from "@workspace/shared/errors"

import type { ApiVariables } from "@/middleware/RequestId"

const checkPostgres = async (db: Db): Promise<boolean> => {
  try {
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

const checkRedis = async (redis: IORedis): Promise<boolean> => {
  try {
    const reply = await redis.ping()
    return reply === "PONG"
  } catch {
    return false
  }
}

/**
 * Build the `/ready` deep-health route. Returns 200 only when both postgres
 * and redis respond. On failure, responds with the standard `ApiError`
 * envelope using `internal.unexpected` so probe failures look the same as
 * any other server-side problem to operators.
 */
export const buildReadyRoute = (params: { db: Db; redis: IORedis }) => {
  const { db, redis } = params
  return new Hono<{ Variables: ApiVariables }>().get("/", async (c) => {
    const [postgresOk, redisOk] = await Promise.all([
      checkPostgres(db),
      checkRedis(redis),
    ])
    if (postgresOk && redisOk) {
      return c.json({ status: "ok", postgres: true, redis: true } as const)
    }
    const exception = new ApiException("internal.unexpected", { status: 503 })
    const payload = serializeApiException(exception, c.get("requestId"))
    return c.json(
      { ...payload.body, postgres: postgresOk, redis: redisOk },
      503
    )
  })
}
