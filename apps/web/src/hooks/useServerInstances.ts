import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  CreateInstanceRequest,
  InstancesResponse,
  PoolSnapshot,
} from "@/hooks/useServerInstances.types"
import type { ServerListRow } from "@/hooks/useServers.types"

const listKey = (serverId: string) =>
  ["servers", serverId, "instances"] as const
const poolKey = (serverId: string) =>
  ["servers", serverId, "pool"] as const

export const useServerInstances = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<InstancesResponse>(`/servers/${serverId}/instances`),
  })

export const useServerPool = (serverId: string) =>
  useQuery({
    queryKey: poolKey(serverId),
    queryFn: () => apiFetch<PoolSnapshot>(`/servers/${serverId}/pool`),
  })

export const useCreateServerInstance = (parentId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateInstanceRequest) =>
      apiFetch<{ instance: ServerListRow }>(
        `/servers/${parentId}/instances`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(parentId) })
      void queryClient.invalidateQueries({ queryKey: poolKey(parentId) })
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}
