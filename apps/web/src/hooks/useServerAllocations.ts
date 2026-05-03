import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  ServerAllocationRow,
  ServerAllocationsResponse,
} from "@/hooks/useServerAllocations.types"

const listKey = (serverId: string) =>
  ["servers", serverId, "allocations"] as const

export const useServerAllocations = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<ServerAllocationsResponse>(`/servers/${serverId}/allocations`),
  })

export const useAssignRandomAllocation = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ allocation: ServerAllocationRow }>(
        `/servers/${serverId}/allocations/random`,
        { method: "POST", body: "{}" }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

export const useSetPrimaryAllocation = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (allocationId: string) =>
      apiFetch<{ ok: boolean }>(
        `/servers/${serverId}/allocations/${allocationId}/primary`,
        { method: "PATCH", body: "{}" }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

export const useUnassignAllocation = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (allocationId: string) =>
      apiFetch<{ ok: boolean }>(
        `/servers/${serverId}/allocations/${allocationId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}
