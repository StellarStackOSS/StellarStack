import { createRoute } from "@tanstack/react-router"

import { AccountNotificationsPage } from "@/components/AccountPage"
import { Route as accountRoute } from "@/routes/Account"

export const Route = createRoute({
  getParentRoute: () => accountRoute,
  path: "/notifications",
  component: AccountNotificationsPage,
})
