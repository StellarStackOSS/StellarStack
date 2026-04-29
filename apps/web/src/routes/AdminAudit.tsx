import { createRoute } from "@tanstack/react-router"

import { AdminAuditPage } from "@/components/AdminAuditPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/audit",
  component: AdminAuditPage,
})
