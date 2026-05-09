import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"

export type ServerDatabaseRow = {
  id: string
  name: string
  username: string
  password: string
  createdAt: string
  host: {
    id: string
    name: string
    dbType: string
    driver: string
    address: string
  }
  connectionString: string
}

export type AttachableHost = {
  id: string
  name: string
  dbType: string
  status: string
  shared: boolean
  suspended: boolean
}

const listKey = (serverId: string) =>
  ["servers", serverId, "databases"] as const
const hostsKey = (serverId: string) =>
  ["servers", serverId, "databases", "hosts"] as const

export const useServerDatabases = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<{ databases: ServerDatabaseRow[] }>(
        `/servers/${serverId}/databases`
      ),
  })

export const useAttachableHosts = (serverId: string) =>
  useQuery({
    queryKey: hostsKey(serverId),
    queryFn: () =>
      apiFetch<{ hosts: AttachableHost[] }>(
        `/servers/${serverId}/databases/hosts`
      ),
  })

export const useCreateDatabase = (serverId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { hostId: string; name?: string }) =>
      apiFetch<{ database: { id: string } }>(
        `/servers/${serverId}/databases`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(serverId) }),
  })
}

export const useDeleteDatabase = (serverId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dbId: string) =>
      apiFetch<{ ok: true }>(
        `/servers/${serverId}/databases/${dbId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(serverId) }),
  })
}
