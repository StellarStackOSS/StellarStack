import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import type { Db } from "@workspace/db/client.types"

import type { Env } from "@/env"

/**
 * Build the better-auth instance bound to the StellarStack database and
 * mailpit/SMTP relay. Email verification is required before sign-in is
 * allowed; password reset emails are routed through the same SMTP transport.
 *
 * Frontend uses the better-auth client (`createAuthClient`) against this
 * instance; backend code uses `auth.api.*` for trusted operations.
 */
export const createAuth = (db: Db, env: Env) => {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.PUBLIC_APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
  })
}

/**
 * Resolved type of the API's better-auth instance. Useful for typing
 * Hono context values without importing the constructor.
 */
export type Auth = ReturnType<typeof createAuth>
