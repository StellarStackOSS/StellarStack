import { createRoute } from "@tanstack/react-router"

import { AccountConnectionsPage } from "@/components/AccountPage"
import { Route as accountRoute } from "@/routes/Account"

export const Route = createRoute({
  getParentRoute: () => accountRoute,
  path: "/connections",
  component: AccountConnectionsPage,
})
