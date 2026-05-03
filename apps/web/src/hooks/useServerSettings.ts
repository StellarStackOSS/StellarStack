import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type { RenameServerRequest } from "@/hooks/useServerSettings.types"

/** Mutation: rename a server. Invalidates the servers list and the detail key. */
export const useRenameServer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RenameServerRequest) =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

/** Mutation: change the server's blueprint and docker image. */
export const useChangeBlueprintServer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { blueprintId: string; dockerImage: string }) =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}/blueprint`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

/** Mutation: trigger a reinstall of the server. */
export const useReinstallServer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { keepFiles: boolean; snapshotFirst: boolean }) =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}/reinstall`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

/** Mutation: permanently delete a server and free its allocation. */
export const useDeleteServer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/servers/${serverId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}
