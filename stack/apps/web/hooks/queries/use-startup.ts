import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { servers, StartupConfig, UpdateStartupData } from "@/lib/api";

export const startupKeys = {
  all: (serverId: string) => ["startup", serverId] as const,
  config: (serverId: string) => [...startupKeys.all(serverId), "config"] as const,
};

export function useStartup(serverId: string | undefined) {
  return useQuery({
    queryKey: startupKeys.config(serverId!),
    queryFn: () => servers.startup.get(serverId!),
    enabled: !!serverId,
  });
}

export function useStartupMutations(serverId: string) {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (data: UpdateStartupData) => servers.startup.update(serverId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: startupKeys.all(serverId) });
    },
  });

  return { update };
}
