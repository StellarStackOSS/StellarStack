import { useQuery } from "@tanstack/react-query";
import { servers } from "@/lib/api";

export const activityKeys = {
  all: (serverId: string) => ["activity", serverId] as const,
  lists: (serverId: string) => [...activityKeys.all(serverId), "list"] as const,
  list: (serverId: string, options?: { limit?: number; offset?: number; event?: string }) =>
    [...activityKeys.lists(serverId), options] as const,
};

export function useActivity(
  serverId: string | undefined,
  options?: { limit?: number; offset?: number; event?: string }
) {
  return useQuery({
    queryKey: activityKeys.list(serverId!, options),
    queryFn: () => servers.activity.list(serverId!, options),
    enabled: !!serverId,
  });
}
