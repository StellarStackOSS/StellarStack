import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/ApiFetch"
import type { ServerActivityResponse } from "@/hooks/useServerActivity.types"

const activityKey = (serverId: string, offset: number) =>
  ["server", serverId, "activity", offset] as const

export const useServerActivity = (serverId: string, offset = 0) =>
  useQuery({
    queryKey: activityKey(serverId, offset),
    queryFn: () =>
      apiFetch<ServerActivityResponse>(
        `/servers/${serverId}/activity?limit=25&offset=${offset}`
      ),
    refetchInterval: 30_000,
  })
