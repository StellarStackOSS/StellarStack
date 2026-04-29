import { createRoute } from "@tanstack/react-router"

import { LoginPage } from "@/components/LoginPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/login` — credential entry. The page component owns its own state and
 * calls into `authClient`; a successful sign-in routes to `/dashboard`.
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})
