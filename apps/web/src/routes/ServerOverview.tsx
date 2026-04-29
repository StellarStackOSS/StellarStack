import { createRoute } from "@tanstack/react-router"

import { OverviewTab } from "@/components/server/OverviewTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/",
  component: OverviewTab,
})
