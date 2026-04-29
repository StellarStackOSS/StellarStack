import { QueryClient } from "@tanstack/react-query"

/**
 * Build the per-process TanStack Query client. Defaults are tuned for an
 * authenticated panel: 30s stale time keeps the dashboard snappy without
 * hammering the API, retries are off for non-GETs (mutations should fail
 * loud), and refetchOnWindowFocus stays on so a returning user sees fresh
 * data without manual reload.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, err) => {
          if (failureCount >= 2) {
            return false
          }
          if (err instanceof Error && err.message.includes("401")) {
            return false
          }
          return true
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
