import { createRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/AuthClient"
import { ServerDetailPage } from "@/components/ServerDetailPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/servers/:id` — per-server detail page. Bounces unauthenticated
 * visitors to /login. The page resolves the server row via TanStack Query
 * and overlays panel-event WS updates for live status.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/servers/$id",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: ServerDetailRouteComponent,
})

const ServerDetailRouteComponent = () => {
  const { id } = Route.useParams()
  return <ServerDetailPage id={id} />
}
