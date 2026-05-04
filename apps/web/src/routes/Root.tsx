import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"

import { PageTitle } from "@/components/PageTitle"

/**
 * Context shape made available to every route via TanStack Router's
 * `createRootRouteWithContext`. The router is constructed in
 * `apps/web/src/router.ts` with a concrete `QueryClient` so routes that
 * need to invalidate or fetch declaratively can reach it without prop
 * drilling.
 */
export type RouterContext = {
  queryClient: QueryClient
}

/**
 * Root route. Renders the matched child via `<Outlet />`. Devtools are
 * mounted alongside the outlet in the dev build.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <PageTitle />
      <Outlet />
    </>
  ),
})
