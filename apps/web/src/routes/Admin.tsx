import { createRoute, redirect } from "@tanstack/react-router"

import { AdminLayout } from "@/components/AdminLayout"
import { authClient } from "@/lib/AuthClient"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/admin` layout route. Hosts the admin sidebar; child routes mount
 * inside its outlet so navigation between nodes/blueprints/users only
 * re-renders the inner page.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: AdminLayout,
})
