import { createRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/AuthClient"
import { DashboardPage } from "@/components/DashboardPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/dashboard` — first session-protected route. `beforeLoad` performs the
 * server-side session check so unauthenticated visitors bounce to /login
 * before the page mounts.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: DashboardPage,
})
