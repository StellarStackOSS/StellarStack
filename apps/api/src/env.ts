import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PANEL_EVENTS_CHANNEL: z.string().default("panel:events"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  PUBLIC_APP_URL: z.string().url(),
  PAIRING_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SMTP_URL: z.string().url(),
  EMAIL_FROM: z.string().email(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
})

/**
 * Parsed environment configuration. Throws with a translation-keyed-friendly
 * message at boot if anything is missing or malformed.
 */
export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate `process.env` into the typed `Env` shape. Call once at
 * boot; pass the result around explicitly rather than reaching for
 * `process.env` from anywhere else.
 */
export const loadEnv = (): Env => {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ")
    throw new Error(`Invalid environment configuration:\n  ${issues}`)
  }
  return parsed.data
}
