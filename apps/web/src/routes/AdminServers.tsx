import { createRoute } from "@tanstack/react-router"

import { AdminServersPage } from "@/components/AdminServersPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/servers",
  component: AdminServersPage,
})
