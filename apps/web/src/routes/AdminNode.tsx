import { createRoute } from "@tanstack/react-router"

import { AdminNodePage } from "@/components/AdminNodePage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/nodes/$nodeId",
  component: AdminNodePage,
})
