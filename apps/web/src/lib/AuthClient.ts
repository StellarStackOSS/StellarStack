import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

import { env } from "@/lib/Env"

/**
 * Better-auth client for the panel. Configured with the additional user
 * fields the API declared (`preferredLocale`, `isAdmin`) so React hooks
 * surface them with their proper types. `credentials: "include"` is
 * required so the session cookie travels on cross-origin requests when
 * the web bundle is served from a different host than the API.
 */
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
        isAdmin: { type: "boolean", required: false },
      },
    }),
  ],
})

/**
 * Convenience hook re-exports so consumers don't have to remember the
 * `authClient.useXyz` indirection.
 */
export const useSession = authClient.useSession
