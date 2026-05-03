import { createRoute } from "@tanstack/react-router"

import { AdminNewServerPage } from "@/components/AdminNewServerPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/create-server",
  component: AdminNewServerPage,
})
