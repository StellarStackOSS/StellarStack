import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { createAppRouter } from "@/router"
import { createQueryClient } from "@/lib/QueryClient"

/**
 * Root application component. Builds the router + query client once for
 * the lifetime of the page; both are otherwise threaded through context
 * to descendants. The shared `QueryClient` is also stashed on the router
 * context so route loaders can call `queryClient.fetchQuery`.
 *
 * `TooltipProvider` is mounted at the root because the shadcn sidebar
 * primitive renders Tooltip components when collapsed-to-icon and
 * requires the provider in scope.
 */
export const App = () => {
  const [queryClient] = useState(() => createQueryClient())
  const [router] = useState(() => createAppRouter(queryClient))

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
