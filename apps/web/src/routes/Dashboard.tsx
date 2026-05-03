import { createRoute } from "@tanstack/react-router"

import { DashboardPage } from "@/components/DashboardPage"
import { Route as userAreaRoute } from "@/routes/UserArea"

export const Route = createRoute({
  getParentRoute: () => userAreaRoute,
  path: "/dashboard",
  component: DashboardPage,
})
