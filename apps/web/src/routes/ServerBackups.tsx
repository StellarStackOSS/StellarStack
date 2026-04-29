import { createRoute } from "@tanstack/react-router"

import { BackupsTab } from "@/components/server/BackupsTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/backups",
  component: BackupsTab,
})
