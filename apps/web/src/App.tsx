import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import { createAppRouter } from "@/router"
import { createQueryClient } from "@/lib/QueryClient"

/**
 * Root application component. Builds the router + query client once for
 * the lifetime of the page; both are otherwise threaded through context
 * to descendants. The shared `QueryClient` is also stashed on the router
 * context so route loaders can call `queryClient.fetchQuery`.
 */
export const App = () => {
  const [queryClient] = useState(() => createQueryClient())
  const [router] = useState(() => createAppRouter(queryClient))

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
