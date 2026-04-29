import { createRoute, redirect } from "@tanstack/react-router"

import { Route as adminRoute } from "@/routes/Admin"

/**
 * `/admin` (no trailing path) — bounce to /admin/nodes so the layout
 * always has a populated outlet.
 */
export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/admin/nodes" })
  },
  component: () => null,
})
