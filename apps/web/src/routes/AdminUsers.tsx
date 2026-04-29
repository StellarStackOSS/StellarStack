import { createRoute } from "@tanstack/react-router"

import { PlaceholderTab } from "@/components/server/PlaceholderTab"
import { Route as adminRoute } from "@/routes/Admin"

const AdminUsersPage = () => (
  <PlaceholderTab
    title="Users"
    description="Manage panel users, admin roles, and email verification state."
    milestone="M12"
  />
)

export const Route = createRoute({
  getParentRoute: () => adminRoute,
  path: "/users",
  component: AdminUsersPage,
})
