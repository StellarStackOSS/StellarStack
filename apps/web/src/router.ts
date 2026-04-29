import { createRouter } from "@tanstack/react-router"

import type { QueryClient } from "@tanstack/react-query"

import { Route as rootRoute } from "@/routes/Root"
import { Route as indexRoute } from "@/routes/Index"
import { Route as loginRoute } from "@/routes/Login"
import { Route as registerRoute } from "@/routes/Register"
import { Route as dashboardRoute } from "@/routes/Dashboard"

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
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
