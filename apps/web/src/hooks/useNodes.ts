import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  CreateNodeRequest,
  NodeListRow,
  PairingTokenResponse,
  UpdateNodeRequest,
} from "@/hooks/useNodes.types"

const QUERY_KEY = ["admin", "nodes"] as const

/**
 * Subscribe to the admin node list. Refetches every 10s so a daemon
 * connecting/disconnecting becomes visible without a manual reload (the
 * panel-event WS already pushes connection-state events; this is the
 * fallback for first-load and stale tabs).
 */
export const useNodes = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<{ nodes: NodeListRow[] }>("/admin/nodes"),
    refetchInterval: 10_000,
  })

/**
 * Mutation: create a new node row. Invalidates the list on success.
 */
export const useCreateNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateNodeRequest) =>
      apiFetch<{ node: NodeListRow }>("/admin/nodes", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export const useUpdateNode = (nodeId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateNodeRequest) =>
      apiFetch<{ node: NodeListRow }>(`/admin/nodes/${nodeId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export const useDeleteNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) =>
      apiFetch<{ deleted: string }>(`/admin/nodes/${nodeId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * Mutation: mint a one-time pairing token for a node. The plaintext token
 * is returned in the response; the UI shows it once (copy-only, never
 * stored) and reissues if the operator dismisses the dialog.
 */
export const useMintPairingToken = () =>
  useMutation({
    mutationFn: (nodeId: string) =>
      apiFetch<PairingTokenResponse>(
        `/admin/nodes/${nodeId}/pairing-tokens`,
        { method: "POST", body: JSON.stringify({}) }
      ),
  })
