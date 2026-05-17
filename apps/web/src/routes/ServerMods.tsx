import { createRoute } from "@tanstack/react-router"

import { ModsTab } from "@/components/server/ModsTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/mods",
  component: ModsTab,
})
