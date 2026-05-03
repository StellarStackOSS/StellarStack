import { createRoute } from "@tanstack/react-router"

import { ProfilePage } from "@/components/ProfilePage"
import { Route as userAreaRoute } from "@/routes/UserArea"

export const Route = createRoute({
  getParentRoute: () => userAreaRoute,
  path: "/profile",
  component: ProfilePage,
})
