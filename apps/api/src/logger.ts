import pino from "pino"

import type { Env } from "@/env"

/**
 * Build the process-wide logger. Pretty-prints in development, NDJSON in
 * production. Child loggers should be created via `logger.child(...)` for
 * per-request context (request id, user id).
 */
export const createLogger = (env: Env): pino.Logger => {
  if (env.NODE_ENV === "development") {
    return pino({
      level: env.LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    })
  }
  return pino({ level: env.LOG_LEVEL })
}
