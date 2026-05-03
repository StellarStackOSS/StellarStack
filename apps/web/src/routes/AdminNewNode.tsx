import { createRoute } from "@tanstack/react-router"

import { AdminNewNodePage } from "@/components/AdminNewNodePage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/create-node",
  component: AdminNewNodePage,
})
