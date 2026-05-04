import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"

import type { Db } from "@workspace/db/client.types"
import {
  accountsTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from "@workspace/db/schema/auth"

import type { Env } from "@/env"

/**
 * Configure better-auth with the Drizzle adapter and the StellarStack-
 * specific user fields. We don't use better-auth's `jwt()` plugin — the
 * daemon-facing JWTs are minted with per-node HMAC keys, which doesn't
 * fit the global-key, user-identity model that plugin assumes.
 *
 * The schema map below is keyed by the table names better-auth's
 * drizzle adapter looks up internally (`users`, `sessions`, `accounts`,
 * `verifications` with `usePlural: true`); our table values are named
 * `usersTable` etc., so we re-export them under the keys the adapter
 * expects.
 */
export const buildAuth = (params: { db: Db; env: Env }) => {
  return betterAuth({
    database: drizzleAdapter(params.db, {
      provider: "pg",
      usePlural: true,
      schema: {
        users: usersTable,
        sessions: sessionsTable,
        accounts: accountsTable,
        verifications: verificationsTable,
      },
    }),
    secret: params.env.BETTER_AUTH_SECRET,
    baseURL: params.env.API_BASE_URL,
    basePath: "/auth",
    trustedOrigins: [params.env.APP_BASE_URL],
    user: {
      additionalFields: {
        preferredLocale: { type: "string", required: false },
        isAdmin: { type: "boolean", required: false },
      },
    },
    emailAndPassword: { enabled: true, autoSignIn: true },
    advanced: {
      crossSubDomainCookies: { enabled: false },
    },
    plugins: [admin()],
  })
}

export type Auth = ReturnType<typeof buildAuth>
