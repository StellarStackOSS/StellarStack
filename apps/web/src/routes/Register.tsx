import { createRoute } from "@tanstack/react-router"

import { RegisterPage } from "@/components/RegisterPage"
import { Route as rootRoute } from "@/routes/Root"

/**
 * `/register` — new account flow. On success the API sends a verification
 * email; the page surfaces a "check your inbox" state and the user
 * verifies before they can sign in (better-auth enforces this).
 */
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
})
