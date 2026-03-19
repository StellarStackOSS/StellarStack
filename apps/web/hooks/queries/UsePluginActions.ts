"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExecuteActionRequest, ExecuteActionResponse } from "@/lib/ApiTypes";
import { pluginsApi } from "@/lib/Api";

/**
 * Hook for executing a plugin action.
 * Handles mutation state and automatically invalidates related queries on success.
 */
export const usePluginAction = (pluginId: string, actionId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ExecuteActionRequest) => {
      return await pluginsApi.executeAction(pluginId, actionId, request);
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to refetch latest state
      queryClient.invalidateQueries({
        queryKey: ["servers", variables.serverId],
      });
      queryClient.invalidateQueries({
        queryKey: ["plugins", pluginId],
      });
    },
  });
};

/**
 * Hook for getting plugin statistics and audit logs.
 */
export const usePluginStats = (pluginId: string, days = 30) => {
  return useMutation({
    mutationFn: async () => {
      return await pluginsApi.getPluginStats(pluginId, days);
    },
  });
};

/**
 * Hook for getting plugin audit logs with filtering.
 */
export const usePluginAuditLog = (pluginId?: string) => {
  return useMutation({
    mutationFn: async (filter?: Record<string, unknown>) => {
      return await pluginsApi.getAuditLog({
        pluginId,
        ...filter,
      });
    },
  });
};
