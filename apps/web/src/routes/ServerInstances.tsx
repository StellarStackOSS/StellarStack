import { createRoute } from "@tanstack/react-router"

import { InstancesTab } from "@/components/server/InstancesTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/instances",
  component: InstancesTab,
})
