import { createRouter } from "@tanstack/react-router"

import type { QueryClient } from "@tanstack/react-query"

import { Route as rootRoute } from "@/routes/Root"
import { Route as indexRoute } from "@/routes/Index"
import { Route as loginRoute } from "@/routes/Login"
import { Route as registerRoute } from "@/routes/Register"
import { Route as dashboardRoute } from "@/routes/Dashboard"
import { Route as adminRoute } from "@/routes/Admin"
import { Route as adminIndexRoute } from "@/routes/AdminIndex"
import { Route as adminNodesRoute } from "@/routes/AdminNodes"
import { Route as adminBlueprintsRoute } from "@/routes/AdminBlueprints"
import { Route as adminUsersRoute } from "@/routes/AdminUsers"
import { Route as newServerRoute } from "@/routes/NewServer"
import { Route as serverRoute } from "@/routes/Server"
import { Route as serverOverviewRoute } from "@/routes/ServerOverview"
import { Route as serverFilesRoute } from "@/routes/ServerFiles"
import { Route as serverBackupsRoute } from "@/routes/ServerBackups"
import { Route as serverSchedulesRoute } from "@/routes/ServerSchedules"
import { Route as serverUsersRoute } from "@/routes/ServerUsers"
import { Route as serverNetworkRoute } from "@/routes/ServerNetwork"
import { Route as serverSettingsRoute } from "@/routes/ServerSettings"

const adminTree = adminRoute.addChildren([
  adminIndexRoute,
  adminNodesRoute,
  adminBlueprintsRoute,
  adminUsersRoute,
])

const serverTree = serverRoute.addChildren([
  serverOverviewRoute,
  serverFilesRoute,
  serverBackupsRoute,
  serverSchedulesRoute,
  serverUsersRoute,
  serverNetworkRoute,
  serverSettingsRoute,
])

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
  adminTree,
  newServerRoute,
  serverTree,
])

/**
 * Build the application router. Accepts the shared `QueryClient` so route
 * loaders can reach for it through `route.options.beforeLoad`/`loader`.
 */
export const createAppRouter = (queryClient: QueryClient) =>
  createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  })

export type AppRouter = ReturnType<typeof createAppRouter>

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter
  }
}
