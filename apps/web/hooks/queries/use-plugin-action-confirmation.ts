import { useState } from "react";
import { pluginsApi } from "@/lib/api";
import type { ExecuteActionRequest, ExecuteActionResponse } from "@/lib/api";

/**
 * Hook for handling plugin action execution with safety confirmations.
 * Automatically detects destructive operations and prompts for backup.
 *
 * Usage:
 * ```tsx
 * const {
 *   confirmDialog,
 *   ConfirmDialog,
 *   executeAction
 * } = usePluginActionConfirmation();
 *
 * const handleInstall = async () => {
 *   await executeAction({
 *     pluginId: "curseforge-installer",
 *     actionId: "install-modpack",
 *     serverId: "server-123",
 *     actionLabel: "Install Modpack",
 *     isDestructive: true,
 *     hasBackupOption: true,
 *     defaultBackup: true,
 *     warnings: [
 *       "This will overwrite existing mods directory",
 *       "Custom configurations may be lost"
 *     ],
 *     inputs: {
 *       modpackId: "12345",
 *       modpackName: "Example Pack"
 *     }
 *   });
 * };
 * ```
 */

export interface ActionConfirmationOptions {
  pluginId: string;
  actionId: string;
  serverId: string;
  actionLabel: string; // e.g., "Install Modpack"
  isDestructive?: boolean; // Default: detect from action
  hasBackupOption?: boolean; // Show backup toggle
  defaultBackup?: boolean; // Default backup state
  warnings?: string[]; // Additional warnings
  inputs: Record<string, unknown>; // Action inputs
  onSuccess?: (result: ExecuteActionResponse) => void;
  onError?: (error: Error) => void;
}

export interface DialogState {
  open: boolean;
  title: string;
  description: string;
  isDestructive: boolean;
  hasBackupOption: boolean;
  backupEnabled: boolean;
  warnings: string[];
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export function usePluginActionConfirmation() {
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    title: "",
    description: "",
    isDestructive: false,
    hasBackupOption: false,
    backupEnabled: true,
    warnings: [],
    onConfirm: async () => {},
    isLoading: false,
  });

  const executeAction = async (options: ActionConfirmationOptions) => {
    const {
      pluginId,
      actionId,
      serverId,
      actionLabel,
      isDestructive = true,
      hasBackupOption = isDestructive,
      defaultBackup = isDestructive,
      warnings = [],
      inputs,
      onSuccess,
      onError,
    } = options;

    // If not destructive or no backup needed, execute directly
    if (!isDestructive && !hasBackupOption) {
      try {
        const result = await pluginsApi.executeAction(pluginId, actionId, {
          serverId,
          inputs,
        });

        onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        throw err;
      }
    }

    // Show confirmation dialog for destructive operations
    return new Promise((resolve, reject) => {
      const confirmHandler = async () => {
        setDialogState((prev) => ({ ...prev, isLoading: true }));

        try {
          const result = await pluginsApi.executeAction(pluginId, actionId, {
            serverId,
            inputs,
            options: {
              createBackup: hasBackupOption && dialogState.backupEnabled,
              backupName: `${pluginId}-${actionLabel.toLowerCase()}-${new Date().toISOString().split("T")[0]}`,
            },
          });

          setDialogState((prev) => ({
            ...prev,
            open: false,
            isLoading: false,
          }));

          onSuccess?.(result);
          resolve(result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          setDialogState((prev) => ({
            ...prev,
            isLoading: false,
          }));
          onError?.(err);
          reject(err);
        }
      };

      setDialogState({
        open: true,
        title: actionLabel,
        description: `You are about to ${actionLabel.toLowerCase()} on this server. This action may modify server files and cannot be undone without a backup.`,
        isDestructive,
        hasBackupOption,
        backupEnabled: defaultBackup,
        warnings,
        onConfirm: confirmHandler,
        isLoading: false,
      });
    });
  };

  const handleBackupToggle = (enabled: boolean) => {
    setDialogState((prev) => ({
      ...prev,
      backupEnabled: enabled,
    }));
  };

  const handleOpenChange = (open: boolean) => {
    setDialogState((prev) => ({
      ...prev,
      open,
    }));
  };

  // Component props for PluginActionConfirmDialog
  const ConfirmDialogProps = {
    open: dialogState.open,
    onOpenChange: handleOpenChange,
    title: dialogState.title,
    description: dialogState.description,
    isDestructive: dialogState.isDestructive,
    hasBackupOption: dialogState.hasBackupOption,
    backupEnabled: dialogState.backupEnabled,
    onBackupToggle: handleBackupToggle,
    confirmText: dialogState.title, // Use action title as button text
    onConfirm: dialogState.onConfirm,
    isLoading: dialogState.isLoading,
    warnings: dialogState.warnings,
  };

  return {
    dialogState,
    executeAction,
    ConfirmDialogProps,
  };
}
