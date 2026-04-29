import { createRoute, redirect } from "@tanstack/react-router"

import { ServerLayout } from "@/components/ServerLayout"
import { authClient } from "@/lib/AuthClient"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/servers/$id` layout route. Hosts the sidebar + outlet. Each tab
 * (Overview/Files/Backups/...) is a child route that mounts inside
 * `ServerLayout`'s outlet, so navigation between tabs only re-renders
 * the inner content.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  id: "server",
  path: "/servers/$id",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: ServerLayout,
})
