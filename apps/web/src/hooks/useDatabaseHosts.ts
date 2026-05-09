import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"

export type DatabaseHostRow = {
  id: string
  name: string
  nodeId: string
  dbType: string
  memoryLimitMb: number
  diskLimitMb: number
  status: "offline" | "starting" | "running" | "stopping"
  suspended: boolean
  shared: boolean
  createdAt: string
  nodeName: string | null
  allocationIp: string | null
  allocationPort: number | null
}

export type DatabaseTypeOption = {
  key: string
  label: string
  driver: string
  defaultPort: number
}

const hostsKey = ["admin", "database-hosts"] as const
const typesKey = ["admin", "database-hosts", "types"] as const

export const useDatabaseHosts = () =>
  useQuery({
    queryKey: hostsKey,
    queryFn: () =>
      apiFetch<{ hosts: DatabaseHostRow[] }>("/admin/database-hosts"),
  })

export const useDatabaseTypes = () =>
  useQuery({
    queryKey: typesKey,
    queryFn: () =>
      apiFetch<{ types: DatabaseTypeOption[] }>(
        "/admin/database-hosts/types"
      ),
  })

export const useCreateDatabaseHost = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      nodeId: string
      dbType: string
      memoryLimitMb: number
      diskLimitMb: number
      shared: boolean
    }) =>
      apiFetch<{ host: DatabaseHostRow }>("/admin/database-hosts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hostsKey }),
  })
}

export const useDeleteDatabaseHost = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/admin/database-hosts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hostsKey }),
  })
}
