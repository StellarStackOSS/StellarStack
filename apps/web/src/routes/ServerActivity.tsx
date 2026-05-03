import { createRoute } from "@tanstack/react-router"

import { ActivityTab } from "@/components/server/ActivityTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/activity",
  component: ActivityTab,
})
