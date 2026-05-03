import { createRoute } from "@tanstack/react-router"

import { SettingsTab } from "@/components/server/SettingsTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/settings",
  component: SettingsTab,
})
