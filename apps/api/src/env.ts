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
