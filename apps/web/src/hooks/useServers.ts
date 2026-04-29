import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  CreateServerRequest,
  ServerListRow,
} from "@/hooks/useServers.types"

const LIST_KEY = ["servers"] as const
const detailKey = (id: string) => ["servers", id] as const

/**
 * Subscribe to the server list scoped to the current user (or all servers
 * for an admin). Polled every 10s as a fallback alongside the panel-event
 * WS push of `server.state.changed`.
 */
export const useServers = () =>
  useQuery({
    queryKey: LIST_KEY,
    queryFn: () => apiFetch<{ servers: ServerListRow[] }>("/servers"),
    refetchInterval: 10_000,
  })

/**
 * Subscribe to a single server.
 */
export const useServer = (id: string | null) =>
  useQuery({
    queryKey: id !== null ? detailKey(id) : ["servers", "_none"],
    queryFn: () => apiFetch<{ server: ServerListRow }>(`/servers/${id ?? ""}`),
    enabled: id !== null,
    refetchInterval: 10_000,
  })

/**
 * Mutation: provision a new server. The server starts in `installing`;
 * the caller routes to the detail page and watches the WS for the
 * transition to `installed_stopped`.
 */
export const useCreateServer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateServerRequest) =>
      apiFetch<{ server: ServerListRow }>("/servers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}
