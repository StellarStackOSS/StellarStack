import { createRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/AuthClient"
import { AdminBlueprintsPage } from "@/components/AdminBlueprintsPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/admin/blueprints` — admin-only blueprint browser + JSON editor. Bounces
 * unauthenticated visitors to /login; non-admin sessions land on the
 * "no access" state inside the page component.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/blueprints",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: AdminBlueprintsPage,
})
