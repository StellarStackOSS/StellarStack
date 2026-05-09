import { createRoute } from "@tanstack/react-router"

import { AdminDatabaseHostsPage } from "@/components/AdminDatabaseHostsPage"
import { Route as adminRoute } from "@/routes/Admin"

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/database-hosts",
  component: AdminDatabaseHostsPage,
})
