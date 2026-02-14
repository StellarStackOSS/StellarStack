/**
 * React Query hooks for the plugin system.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pluginsApi, type PluginInfo } from "@/lib/Api";
import { toast } from "sonner";

/** Query key factory for plugins */
export const pluginKeys = {
  all: ["plugins"] as const,
  list: () => [...pluginKeys.all, "list"] as const,
  detail: (pluginId: string) => [...pluginKeys.all, "detail", pluginId] as const,
  serverTabs: (serverId: string) => [...pluginKeys.all, "serverTabs", serverId] as const,
};

/** Get all plugins */
export const usePlugins = () => {
  return useQuery({
    queryKey: pluginKeys.list(),
    queryFn: () => pluginsApi.list(),
  });
};

/** Get a specific plugin */
export const usePlugin = (pluginId: string) => {
  return useQuery({
    queryKey: pluginKeys.detail(pluginId),
    queryFn: () => pluginsApi.get(pluginId),
    enabled: !!pluginId,
  });
};

/** Get server tab plugins for a specific server */
export const useServerTabPlugins = (serverId: string) => {
  return useQuery({
    queryKey: pluginKeys.serverTabs(serverId),
    queryFn: () => pluginsApi.getServerTabs(serverId),
    enabled: !!serverId,
  });
};

/** Plugin mutations (enable, disable, configure, uninstall) */
export const usePluginMutations = () => {
  const queryClient = useQueryClient();

  const enable = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.enable(pluginId),
    onSuccess: (plugin) => {
      toast.success(`${plugin.name} enabled`);
      queryClient.invalidateQueries({ queryKey: pluginKeys.all });
    },
    onError: () => {
      toast.error("Failed to enable plugin");
    },
  });

  const disable = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.disable(pluginId),
    onSuccess: (plugin) => {
      toast.success(`${plugin.name} disabled`);
      queryClient.invalidateQueries({ queryKey: pluginKeys.all });
    },
    onError: () => {
      toast.error("Failed to disable plugin");
    },
  });

  const updateConfig = useMutation({
    mutationFn: ({ pluginId, config }: { pluginId: string; config: Record<string, unknown> }) =>
      pluginsApi.updateConfig(pluginId, config),
    onSuccess: (plugin) => {
      toast.success(`${plugin.name} configuration updated`);
      queryClient.invalidateQueries({ queryKey: pluginKeys.all });
    },
    onError: () => {
      toast.error("Failed to update plugin configuration");
    },
  });

  const uninstall = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.uninstall(pluginId),
    onSuccess: () => {
      toast.success("Plugin uninstalled");
      queryClient.invalidateQueries({ queryKey: pluginKeys.all });
    },
    onError: () => {
      toast.error("Failed to uninstall plugin");
    },
  });

  return { enable, disable, updateConfig, uninstall };
};
