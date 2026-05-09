import { createRoute } from "@tanstack/react-router"

import { DatabasesTab } from "@/components/server/DatabasesTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/databases",
  component: DatabasesTab,
})
