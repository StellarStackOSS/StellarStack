import { createRoute } from "@tanstack/react-router"

import { NetworkTab } from "@/components/server/NetworkTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/network",
  component: NetworkTab,
})
