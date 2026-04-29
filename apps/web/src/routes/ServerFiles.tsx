import { createRoute } from "@tanstack/react-router"

import { FilesTab } from "@/components/server/FilesTab"
import { Route as serverRoute } from "@/routes/Server"

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/files",
  component: FilesTab,
})
