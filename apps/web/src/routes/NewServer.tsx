import { createRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/AuthClient"
import { NewServerPage } from "@/components/NewServerPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/servers/new` — server provisioning wizard. Bounces unauthenticated
 * visitors to /login.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/servers/new",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: NewServerPage,
})
