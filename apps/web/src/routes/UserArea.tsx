import { createRoute, redirect } from "@tanstack/react-router"

import { UserAreaLayout } from "@/components/UserAreaLayout"
import { authClient } from "@/lib/AuthClient"
import { Route as rootRoute } from "@/routes/Root"

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  id: "user-area",
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data === null) {
      throw redirect({ to: "/login" })
    }
  },
  component: UserAreaLayout,
})
