import { createRouter } from "@tanstack/react-router"

import type { QueryClient } from "@tanstack/react-query"

import { Route as rootRoute } from "@/routes/Root"
import { Route as indexRoute } from "@/routes/Index"
import { Route as loginRoute } from "@/routes/Login"
import { Route as userAreaRoute } from "@/routes/UserArea"
import { Route as dashboardRoute } from "@/routes/Dashboard"
import { Route as accountRoute } from "@/routes/Account"
import { Route as accountIndexRoute } from "@/routes/AccountIndex"
import { Route as accountNotificationsRoute } from "@/routes/AccountNotifications"
import { Route as accountConnectionsRoute } from "@/routes/AccountConnections"
import { Route as newServerRoute } from "@/routes/NewServer"
import { Route as adminRoute } from "@/routes/Admin"
import { Route as adminIndexRoute } from "@/routes/AdminIndex"
import { Route as adminNodesRoute } from "@/routes/AdminNodes"
import { Route as adminNewNodeRoute } from "@/routes/AdminNewNode"
import { Route as adminNodeRoute } from "@/routes/AdminNode"
import { Route as adminBlueprintsRoute } from "@/routes/AdminBlueprints"
import { Route as adminDatabaseHostsRoute } from "@/routes/AdminDatabaseHosts"
import { Route as adminNewBlueprintRoute } from "@/routes/AdminNewBlueprint"
import { Route as adminAuditRoute } from "@/routes/AdminAudit"
import { Route as adminExtensionsRoute } from "@/routes/AdminExtensions"
import { Route as adminUsersRoute } from "@/routes/AdminUsers"
import { Route as adminServersRoute } from "@/routes/AdminServers"
import { Route as adminNewServerRoute } from "@/routes/AdminNewServer"
import { Route as adminServerRoute } from "@/routes/AdminServer"
import { Route as serverRoute } from "@/routes/Server"
import { Route as serverOverviewRoute } from "@/routes/ServerOverview"
import { Route as serverFilesRoute } from "@/routes/ServerFiles"
import { Route as serverBackupsRoute } from "@/routes/ServerBackups"
import { Route as serverSchedulesRoute } from "@/routes/ServerSchedules"
import { Route as serverUsersRoute } from "@/routes/ServerUsers"
import { Route as serverNetworkRoute } from "@/routes/ServerNetwork"
import { Route as serverSettingsRoute } from "@/routes/ServerSettings"
import { Route as serverStartupRoute } from "@/routes/ServerStartup"
import { Route as serverActivityRoute } from "@/routes/ServerActivity"
import { Route as serverCrashesRoute } from "@/routes/ServerCrashes"
import { Route as serverTransferRoute } from "@/routes/ServerTransfer"
import { Route as serverInstancesRoute } from "@/routes/ServerInstances"
import { Route as serverDatabasesRoute } from "@/routes/ServerDatabases"
import { Route as serverModsRoute } from "@/routes/ServerMods"

const accountTree = accountRoute.addChildren([
  accountIndexRoute,
  accountNotificationsRoute,
  accountConnectionsRoute,
])

const userAreaTree = userAreaRoute.addChildren([
  dashboardRoute,
  accountTree,
  newServerRoute,
])

const adminTree = adminRoute.addChildren([
  adminIndexRoute,
  adminNodesRoute,
  adminNewNodeRoute,
  adminNodeRoute,
  adminBlueprintsRoute,
  adminNewBlueprintRoute,
  adminDatabaseHostsRoute,
  adminUsersRoute,
  adminServersRoute,
  adminNewServerRoute,
  adminServerRoute,
  adminAuditRoute,
  adminExtensionsRoute,
])

const serverTree = serverRoute.addChildren([
  serverOverviewRoute,
  serverFilesRoute,
  serverBackupsRoute,
  serverSchedulesRoute,
  serverUsersRoute,
  serverNetworkRoute,
  serverStartupRoute,
  serverActivityRoute,
  serverCrashesRoute,
  serverSettingsRoute,
  serverTransferRoute,
  serverInstancesRoute,
  serverDatabasesRoute,
  serverModsRoute,
])

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  userAreaTree,
  adminTree,
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
