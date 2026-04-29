import { createRoute } from "@tanstack/react-router"

import { SchedulesTab } from "@/components/server/SchedulesTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/schedules",
  component: SchedulesTab,
})
