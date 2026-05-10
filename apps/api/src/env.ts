import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  APP_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DAEMON_HMAC_SKEW_SECONDS: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Desktop-only. When set, the API runs Drizzle migrations from this
  // folder on boot. Hosted deploys leave this empty and run migrations
  // out-of-band via `pnpm db:migrate`.
  STELLAR_AUTO_MIGRATE_PATH: z.string().optional(),
  // Desktop-only. Single-node HMAC key the desktop app generated for
  // its bundled daemon. The /setup route inserts the local node row
  // with this as `daemonPublicKey`.
  STELLAR_DESKTOP_DAEMON_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export const loadEnv = (): Env => {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ")
    throw new Error(`Invalid env:\n  ${issues}`)
  }
  return parsed.data
}
