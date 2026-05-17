import { createRoute } from "@tanstack/react-router"

import { AdminExtensionsPage } from "@/components/AdminExtensionsPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/extensions",
  component: AdminExtensionsPage,
})
