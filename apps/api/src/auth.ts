import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import type { Db } from "@workspace/db/client.types"
import {
  accountsTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from "@workspace/db/schema/auth"

import type { Env } from "@/env"
import { sendEmail } from "@/email"

/**
 * Build the better-auth instance bound to the StellarStack database and
 * SMTP relay. Email verification is required before sign-in is allowed;
 * password reset emails are routed through the same transport.
 *
 * Frontend uses the better-auth client (`createAuthClient`) against this
 * instance; backend code uses `auth.api.*` for trusted operations.
 */
export const createAuth = (db: Db, env: Env) => {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: {
        users: usersTable,
        sessions: sessionsTable,
        accounts: accountsTable,
        verifications: verificationsTable,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/auth",
    trustedOrigins: [env.PUBLIC_APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subjectKey: "auth.password_reset.subject",
          bodyKey: "auth.password_reset.body",
          params: { name: user.name, url },
        })
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subjectKey: "auth.verify_email.subject",
          bodyKey: "auth.verify_email.body",
          params: {
            name: user.name,
            url,
            expiresMinutes: 60,
          },
        })
      },
    },
    user: {
      additionalFields: {
        preferredLocale: { type: "string", required: false, defaultValue: "en" },
        isAdmin: { type: "boolean", required: false, defaultValue: false },
      },
    },
    advanced: {
      database: {
        generateId: false,
      },
    },
  })
}

/**
 * Resolved type of the API's better-auth instance. Useful for typing
 * Hono context values without importing the constructor.
 */
export type Auth = ReturnType<typeof createAuth>
