import { Outlet, createRoute } from "@tanstack/react-router"

import { Route as userAreaRoute } from "@/routes/UserArea"

/**
 * `/account` is a layout route — child segments (notifications,
 * connections, …) render via the Outlet. The default index page lives
 * in `AccountIndex.tsx` so the bare `/account` URL renders the
 * profile-and-security stack.
 */
export const Route = createRoute({
  getParentRoute: () => userAreaRoute,
  path: "/account",
  component: () => <Outlet />,
})
