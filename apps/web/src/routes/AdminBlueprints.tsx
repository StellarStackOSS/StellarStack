import { createRoute } from "@tanstack/react-router"

import { AdminBlueprintsPage } from "@/components/AdminBlueprintsPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/blueprints",
  component: AdminBlueprintsPage,
})
