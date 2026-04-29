import { createRoute } from "@tanstack/react-router"

import { PlaceholderTab } from "@/components/server/PlaceholderTab"
import { Route as serverRoute } from "@/routes/Server"

const ServerSettingsTab = () => (
  <PlaceholderTab
    title="Settings"
    description="Rename, transfer, and delete the server."
    milestone="M14"
  />
)

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/settings",
  component: ServerSettingsTab,
})
