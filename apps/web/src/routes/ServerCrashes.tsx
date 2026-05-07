import { createRoute } from "@tanstack/react-router"

import { CrashesTab } from "@/components/server/CrashesTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/crashes",
  component: CrashesTab,
})
