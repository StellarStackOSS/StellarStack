import { createRoute } from "@tanstack/react-router"

import { AdminNodesPage } from "@/components/AdminNodesPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/nodes",
  component: AdminNodesPage,
})
