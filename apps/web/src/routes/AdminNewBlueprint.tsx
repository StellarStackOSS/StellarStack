import { createRoute } from "@tanstack/react-router"

import { AdminNewBlueprintPage } from "@/components/AdminNewBlueprintPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/create-blueprint",
  component: AdminNewBlueprintPage,
})
