import { createRoute } from "@tanstack/react-router"

import { PlaceholderTab } from "@/components/server/PlaceholderTab"
import { Route as serverRoute } from "@/routes/Server"

const ServerBackupsTab = () => (
  <PlaceholderTab
    title="Backups"
    description="Take, restore, and download server backups. Local + S3 destinations."
    milestone="M11"
  />
)

export const Route = createRoute({
  getParentRoute: () => serverRoute,
  path: "/backups",
  component: ServerBackupsTab,
})
