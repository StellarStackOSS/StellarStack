"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExecuteActionRequest, ExecuteActionResponse } from "@/lib/api.types";
import { pluginsApi } from "@/lib/api";

/**
 * Hook for executing a plugin action.
 * Handles mutation state and automatically invalidates related queries on success.
 */
export function usePluginAction(pluginId: string, actionId: string) {
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
}

/**
 * Hook for getting plugin statistics and audit logs.
 */
export function usePluginStats(pluginId: string, days = 30) {
  return useMutation({
    mutationFn: async () => {
      return await pluginsApi.getPluginStats(pluginId, days);
    },
  });
}

/**
 * Hook for getting plugin audit logs with filtering.
 */
export function usePluginAuditLog(pluginId?: string) {
  return useMutation({
    mutationFn: async (filter?: Record<string, any>) => {
      return await pluginsApi.getAuditLog({
        pluginId,
        ...filter,
      });
    },
  });
}
