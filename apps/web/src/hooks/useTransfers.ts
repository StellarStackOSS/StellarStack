import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type { TransferInput, TransferRow } from "@/hooks/useTransfers.types"

const listKey = (serverId: string) =>
  ["servers", serverId, "transfers"] as const

export const useTransfers = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<{ transfers: TransferRow[] }>(
        `/servers/${serverId}/transfers`
      ),
    refetchInterval: 10_000,
  })

export const useCreateTransfer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TransferInput) =>
      apiFetch<{ transfer: TransferRow }>(`/servers/${serverId}/transfer`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}
