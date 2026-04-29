import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  InviteSubuserRequest,
  SubuserRow,
  UpdateSubuserRequest,
} from "@/hooks/useSubusers.types"

const listKey = (serverId: string) =>
  ["servers", serverId, "subusers"] as const

/**
 * Subscribe to the subuser list for a server. Owners and admins see the
 * full list; subusers themselves get a 403 from the API.
 */
export const useSubusers = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<{ subusers: SubuserRow[] }>(`/servers/${serverId}/subusers`),
  })

/**
 * Invite an existing account to this server with the given permission set.
 * The target must already have a panel account — the platform doesn't
 * auto-provision users from invites in v1.
 */
export const useInviteSubuser = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: InviteSubuserRequest) =>
      apiFetch<{ subuser: SubuserRow }>(`/servers/${serverId}/subusers`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Replace a subuser's permission set. The API expects the full desired
 * scope array, not a delta.
 */
export const useUpdateSubuser = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { subuserId: string } & UpdateSubuserRequest) =>
      apiFetch<{ subuser: SubuserRow }>(
        `/servers/${serverId}/subusers/${params.subuserId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ permissions: params.permissions }),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Revoke a subuser's access entirely.
 */
export const useDeleteSubuser = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subuserId: string) =>
      apiFetch<{ ok: true }>(
        `/servers/${serverId}/subusers/${subuserId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}
