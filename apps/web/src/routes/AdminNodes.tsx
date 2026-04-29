import { createRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/AuthClient"
import { AdminNodesPage } from "@/components/AdminNodesPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/admin/nodes` — admin-only node management. `beforeLoad` resolves the
 * session before mount; non-authenticated visitors bounce to /login,
 * non-admins receive the in-page "no access" state.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/nodes",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: AdminNodesPage,
})
