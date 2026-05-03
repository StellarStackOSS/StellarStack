import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type { AdminServerDetail, AdminServerRow } from "@/hooks/useAdminServers.types"

export type AdminCreateServerRequest = {
  name: string
  ownerId: string
  blueprintId: string
  nodeId: string
  dockerImage: string
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  variables: Record<string, string>
}

const LIST_KEY = ["admin", "servers"] as const
const detailKey = (id: string) => ["admin", "servers", id] as const

export const useAdminServers = () =>
  useQuery({
    queryKey: LIST_KEY,
    queryFn: () => apiFetch<{ servers: AdminServerRow[] }>("/admin/servers"),
  })

export const useAdminServerDetail = (id: string | null) =>
  useQuery({
    queryKey: id !== null ? detailKey(id) : ["admin", "servers", "_none"],
    queryFn: () => apiFetch<AdminServerDetail>(`/admin/servers/${id ?? ""}`),
    enabled: id !== null,
  })

export const useAdminUpdateServer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      memoryLimitMb?: number
      cpuLimitPercent?: number
      diskLimitMb?: number
      blueprintId?: string
      dockerImage?: string
      ownerId?: string
    }) =>
      apiFetch<{ ok: boolean }>(`/admin/servers/${serverId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: detailKey(serverId) })
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

export const useAdminUpdateVariables = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: Record<string, string>) =>
      apiFetch<{ ok: boolean }>(`/admin/servers/${serverId}/variables`, {
        method: "PUT",
        body: JSON.stringify({ variables }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(serverId) })
    },
  })
}

export const useAdminAddAllocation = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (allocationId: string) =>
      apiFetch<{ ok: boolean }>(`/admin/servers/${serverId}/allocations`, {
        method: "POST",
        body: JSON.stringify({ allocationId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(serverId) })
    },
  })
}

export const useAdminRemoveAllocation = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (allocationId: string) =>
      apiFetch<{ ok: boolean }>(
        `/admin/servers/${serverId}/allocations/${allocationId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(serverId) })
    },
  })
}

export const useAdminSetPrimaryAllocation = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (allocationId: string) =>
      apiFetch<{ ok: boolean }>(`/admin/servers/${serverId}/primary-allocation`, {
        method: "PATCH",
        body: JSON.stringify({ allocationId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(serverId) })
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

export const useAdminReinstallServer = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { keepFiles: boolean; snapshotFirst: boolean }) =>
      apiFetch<{ ok: boolean }>(`/admin/servers/${serverId}/reinstall`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

export const useAdminToggleSuspend = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serverId: string) =>
      apiFetch<{ ok: boolean; suspended: boolean }>(
        `/admin/servers/${serverId}/suspend`,
        { method: "PATCH", body: JSON.stringify({}) }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

export const useAdminCreateServer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AdminCreateServerRequest) =>
      apiFetch<{ server: AdminServerRow }>("/admin/servers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}

export const useAdminDeleteServer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serverId: string) =>
      apiFetch<{ ok: boolean }>(`/admin/servers/${serverId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })
}
