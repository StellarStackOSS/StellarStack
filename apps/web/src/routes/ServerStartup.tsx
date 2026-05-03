import { createRoute } from "@tanstack/react-router"

import { StartupTab } from "@/components/server/StartupTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/startup",
  component: StartupTab,
})
