import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/ApiFetch"
import type { ServerCrashesResponse } from "@/hooks/useServerCrashes.types"

const crashesKey = (serverId: string, offset: number) =>
  ["server", serverId, "crashes", offset] as const

export const useServerCrashes = (serverId: string, offset = 0) =>
  useQuery({
    queryKey: crashesKey(serverId, offset),
    queryFn: () =>
      apiFetch<ServerCrashesResponse>(
        `/servers/${serverId}/crashes?limit=25&offset=${offset}`
      ),
    refetchInterval: 30_000,
  })
