import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  AllocationRow,
  CreateAllocationsRequest,
} from "@/hooks/useAllocations.types"

const allocationsKey = (nodeId: string) =>
  ["admin", "nodes", nodeId, "allocations"] as const

/**
 * Subscribe to a node's allocation pool. Polled every 10s so a freshly
 * assigned allocation surfaces without the admin reloading the page.
 */
export const useAllocations = (nodeId: string | null) =>
  useQuery({
    queryKey:
      nodeId !== null
        ? allocationsKey(nodeId)
        : ["admin", "nodes", "_none", "allocations"],
    queryFn: () =>
      apiFetch<{ allocations: AllocationRow[] }>(
        `/admin/nodes/${nodeId ?? ""}/allocations`
      ),
    enabled: nodeId !== null,
    refetchInterval: 10_000,
  })

/**
 * Mutation: append allocations to a node. Accepts either an explicit list
 * of ports or a [start, end] range; the server expands the range and
 * dedupes against existing rows.
 */
export const useCreateAllocations = (nodeId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAllocationsRequest) =>
      apiFetch<{ created: number; allocations: AllocationRow[] }>(
        `/admin/nodes/${nodeId}/allocations`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allocationsKey(nodeId) })
    },
  })
}

/**
 * Mutation: delete one or more allocations. Server rejects deletion of
 * allocations currently bound to a server.
 */
export const useDeleteAllocations = (nodeId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: number }>(
        `/admin/nodes/${nodeId}/allocations?ids=${ids.join(",")}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allocationsKey(nodeId) })
    },
  })
}
