import { createRoute } from "@tanstack/react-router"

import { NewServerPage } from "@/components/NewServerPage"
import { Route as userAreaRoute } from "@/routes/UserArea"

export const Route = createRoute({
  getParentRoute: () => userAreaRoute,
  path: "/servers/new",
  component: NewServerPage,
})
