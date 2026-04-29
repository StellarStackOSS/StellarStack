import { createRoute } from "@tanstack/react-router"

import { SubusersTab } from "@/components/server/SubusersTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/users",
  component: SubusersTab,
})
