import { createRoute } from "@tanstack/react-router"

import { PlaceholderTab } from "@/components/server/PlaceholderTab"
import { Route as serverRoute } from "@/routes/Server"

const ServerSchedulesTab = () => (
  <PlaceholderTab
    title="Schedules"
    description="Cron-style power actions, console commands, and backups."
    milestone="M13"
  />
)

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/schedules",
  component: ServerSchedulesTab,
})
