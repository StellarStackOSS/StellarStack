import { createRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/AuthClient"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/` redirects to `/dashboard` when a session exists, otherwise `/login`.
 * Resolved inside `beforeLoad` so the redirect happens before any UI
 * renders.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data !== null) {
      throw redirect({ to: "/dashboard" })
    }
    throw redirect({ to: "/login" })
  },
  component: () => null,
})
