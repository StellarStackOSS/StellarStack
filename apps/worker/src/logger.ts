import pino from "pino"

import type { Env } from "@/env"

/**
 * Worker-side logger. Mirrors the API's setup so log lines look the same in
 * dev consoles. Per-job context (job id, queue) should be added via child
 * loggers from the handler.
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
