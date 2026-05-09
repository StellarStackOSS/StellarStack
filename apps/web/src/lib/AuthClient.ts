import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins"

import { env } from "@/lib/Env"

export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    inferAdditionalFields({
      user: {
        preferredLocale: { type: "string", required: false },
        timezone: { type: "string", required: false },
        isAdmin: { type: "boolean", required: false },
        twoFactorEnabled: { type: "boolean", required: false },
      },
    }),
    twoFactorClient(),
    passkeyClient(),
  ],
})

export const useSession = authClient.useSession
