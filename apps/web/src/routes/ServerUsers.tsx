import { createRoute } from "@tanstack/react-router"

import { PlaceholderTab } from "@/components/server/PlaceholderTab"
import { Route as serverRoute } from "@/routes/Server"

const ServerUsersTab = () => (
  <PlaceholderTab
    title="Users"
    description="Subusers + per-server permission scopes."
    milestone="M12"
  />
)

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/users",
  component: ServerUsersTab,
})
