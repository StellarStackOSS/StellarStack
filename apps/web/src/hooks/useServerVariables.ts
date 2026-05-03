import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/ApiFetch"
import type { ServerVariablesResponse } from "@/hooks/useServerVariables.types"

const variablesKey = (serverId: string) => ["server", serverId, "variables"] as const

export const useServerVariables = (serverId: string) =>
  useQuery({
    queryKey: variablesKey(serverId),
    queryFn: () => apiFetch<ServerVariablesResponse>(`/servers/${serverId}/variables`),
  })

export const useUpdateServerVariables = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: Record<string, string>) =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}/variables`, {
        method: "PATCH",
        body: JSON.stringify({ variables }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: variablesKey(serverId) })
    },
  })
}

export const useUpdateStartupExtra = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (startupExtra: string) =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}/startup`, {
        method: "PATCH",
        body: JSON.stringify({ startupExtra }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: variablesKey(serverId) })
    },
  })
}

export const useUpdateDockerImage = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dockerImage: string) =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}/docker-image`, {
        method: "PATCH",
        body: JSON.stringify({ dockerImage }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: variablesKey(serverId) })
    },
  })
}
