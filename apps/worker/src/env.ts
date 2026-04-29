import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PANEL_EVENTS_CHANNEL: z.string().default("panel:events"),
  DAEMON_CMD_CHANNEL: z.string().default("daemon:cmd"),
  DAEMON_RESP_CHANNEL: z.string().default("daemon:resp"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(8),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
})

/**
 * Parsed worker environment configuration.
 */
export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate `process.env` for the worker process.
 */
export const loadEnv = (): Env => {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ")
    throw new Error(`Invalid worker environment configuration:\n  ${issues}`)
  }
  return parsed.data
}
