import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  BackupDestination,
  BackupRow,
  UpsertDestinationRequest,
} from "@/hooks/useBackups.types"
import { useFileCredentials } from "@/hooks/useFiles"

const listKey = (serverId: string) =>
  ["servers", serverId, "backups"] as const
const destKey = (serverId: string) =>
  ["servers", serverId, "backups", "destination"] as const

/**
 * Subscribe to a server's backup list. Polled every 5s while any row is
 * still in `pending` so the UI tracks the worker without manual reload.
 */
export const useBackups = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<{ backups: BackupRow[] }>(`/servers/${serverId}/backups`),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data === undefined) {
        return 10_000
      }
      const pending = data.backups.some((b) => b.state === "pending")
      return pending ? 3_000 : 10_000
    },
  })

/**
 * Mint a new backup. Returns immediately; the worker drives the daemon
 * and the row's state moves through `pending → ready` (or `failed`).
 */
export const useCreateBackup = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; destinationId?: string }) =>
      apiFetch<{ backup: BackupRow }>(`/servers/${serverId}/backups`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Restore a backup over the live bind-mount. Server must be in a
 * non-running state. Pass `snapshotBeforeRestore: true` to have the worker
 * archive the current files before overwriting them.
 */
export const useRestoreBackup = (serverId: string) =>
  useMutation({
    mutationFn: (params: { backupId: string; snapshotBeforeRestore: boolean }) =>
      apiFetch<{ ok: true }>(
        `/servers/${serverId}/backups/${params.backupId}/restore`,
        {
          method: "POST",
          body: JSON.stringify({
            snapshotBeforeRestore: params.snapshotBeforeRestore,
          }),
        }
      ),
  })

/**
 * Delete a backup. Refused server-side if `locked`.
 */
export const useDeleteBackup = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) =>
      apiFetch<{ ok: true }>(`/servers/${serverId}/backups/${backupId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Toggle a backup's lock flag. Locked rows cannot be deleted.
 */
export const useLockBackup = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { backupId: string; locked: boolean }) =>
      apiFetch<{ backup: BackupRow }>(
        `/servers/${serverId}/backups/${params.backupId}/lock`,
        { method: "POST", body: JSON.stringify({ locked: params.locked }) }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Read the current S3 destination configuration (without the secret key).
 */
export const useBackupDestination = (serverId: string) =>
  useQuery({
    queryKey: destKey(serverId),
    queryFn: () =>
      apiFetch<{ destination: BackupDestination | null }>(
        `/servers/${serverId}/destination`
      ),
  })

/**
 * Insert or update the S3 destination.
 */
export const useUpsertBackupDestination = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpsertDestinationRequest) =>
      apiFetch<{ destinationId: string }>(`/servers/${serverId}/destination`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: destKey(serverId) })
    },
  })
}

/**
 * Drop the S3 destination. Future backups land locally only.
 */
export const useDeleteBackupDestination = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/servers/${serverId}/destination`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: destKey(serverId) })
    },
  })
}

/**
 * Trigger a browser download of a local backup archive directly from
 * the daemon node. Only available for `storage === "local"` ready backups.
 */
export const useDownloadBackup = (serverId: string) => {
  const credentials = useFileCredentials(serverId)
  return useCallback(
    async (name: string) => {
      const cred = await credentials.get()
      const url = new URL(cred.baseUrl + "/backups/download")
      url.searchParams.set("token", cred.token)
      url.searchParams.set("name", name)
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${cred.token}` },
      })
      if (!response.ok) {
        throw new Error(`daemon error ${response.status}`)
      }
      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition") ?? ""
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match ? match[1] : `${name}.tar.gz`
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(objectUrl)
    },
    [credentials]
  )
}
