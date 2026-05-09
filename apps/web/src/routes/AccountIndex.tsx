import { createRoute } from "@tanstack/react-router"

import { AccountPage } from "@/components/AccountPage"
import { Route as accountRoute } from "@/routes/Account"

export const Route = createRoute({
  getParentRoute: () => accountRoute,
  path: "/",
  component: AccountPage,
})
