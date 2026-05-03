import { createRoute } from "@tanstack/react-router"

import { TransfersTab } from "@/components/server/TransfersTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/transfer",
  component: TransfersTab,
})
