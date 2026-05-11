import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { count, eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import {
  accountsTable,
  passkeyTable,
  sessionsTable,
  twoFactorTable,
  usersTable,
  verificationsTable,
} from "@workspace/db/schema/auth"

import type { Env } from "@/env"

export const buildAuth = (params: { db: Db; env: Env }) => {
  const appOrigin = new URL(params.env.APP_BASE_URL).origin
  const rpID = new URL(params.env.APP_BASE_URL).hostname

  return betterAuth({
    database: drizzleAdapter(params.db, {
      provider: "pg",
      usePlural: true,
      schema: {
        users: usersTable,
        sessions: sessionsTable,
        accounts: accountsTable,
        verifications: verificationsTable,
        twoFactors: twoFactorTable,
        passkeys: passkeyTable,
      },
    }),
    secret: params.env.BETTER_AUTH_SECRET,
    baseURL: params.env.API_BASE_URL,
    basePath: "/auth",
    trustedOrigins:
      process.env["STELLAR_DESKTOP"] === "1"
        ? [params.env.APP_BASE_URL, "http://localhost:5173", "stellar://panel"]
        : [params.env.APP_BASE_URL],
    user: {
      additionalFields: {
        preferredLocale: { type: "string", required: false },
        timezone: { type: "string", required: false },
        isAdmin: { type: "boolean", required: false },
      },
    },
    // disableSignUp blocks the /auth/sign-up/email HTTP endpoint so users
    // can't self-register. New accounts only get minted via:
    //   - desktop onboarding → /api/setup (server-side auth.api.signUpEmail
    //     bypasses the HTTP-level disable)
    //   - admin "invite user" flow in the panel (also server-side)
    emailAndPassword: { enabled: true, autoSignIn: true, disableSignUp: true },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const rows = await params.db
              .select({ value: count() })
              .from(usersTable)
            if (rows[0]?.value === 1) {
              await params.db
                .update(usersTable)
                .set({ isAdmin: true })
                .where(eq(usersTable.id, user.id))
            }
          },
        },
      },
    },
    advanced: {
      crossSubDomainCookies: { enabled: false },
      database: { generateId: false },
    },
    plugins: [
      admin(),
      twoFactor({ issuer: "StellarStack" }),
      passkey({ rpID, rpName: "StellarStack", origin: appOrigin }),
    ],
  })
}

export type Auth = ReturnType<typeof buildAuth>
