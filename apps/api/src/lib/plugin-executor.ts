/**
 * StellarStack Plugin Action Executor
 *
 * Executes plugin actions based on manifest definitions.
 * Processes sequential operations (download, write, delete, command, restart, backup)
 * with context-aware parameter substitution and permission enforcement.
 *
 * Built-in plugins execute actions directly in the main process.
 * Community plugins execute actions in isolated worker processes via IPC.
 */

import type { PluginManifest } from "./plugin-manager";
import { db } from "./db";
import type { Server } from "@prisma/client";
import { pluginWorkerPool } from "./plugin-worker";
import type { PluginWorker } from "./plugin-worker";

// ============================================
// Types
// ============================================

export interface ExecuteActionRequest {
  serverId: string;
  inputs: Record<string, unknown>;
  options?: {
    skipBackup?: boolean;
    skipRestart?: boolean;
    createBackup?: boolean; // Create backup before destructive operations
    backupName?: string; // Custom backup name
  };
}

export interface ExecuteActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  executedOperations?: number;
}

export interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  serverId: string;
  server: Server;
  config: Record<string, unknown>;
  userId: string;
}

interface Operation {
  type: string;
  [key: string]: unknown;
}

// ============================================
// Plugin Action Executor
// ============================================

export class PluginActionExecutor {
  /**
   * Execute a plugin action based on its manifest definition.
   * Validates permissions and executes all operations in sequence.
   *
   * - Built-in plugins: Execute directly in this process
   * - Community plugins: Execute in isolated worker process via IPC
   */
  async executeAction(
    pluginId: string,
    actionId: string,
    request: ExecuteActionRequest,
    context: PluginContext
  ): Promise<ExecuteActionResponse> {
    try {
      // 1. Load plugin manifest
      const plugin = await db.plugin.findUnique({
        where: { pluginId },
      });

      if (!plugin) {
        return {
          success: false,
          error: `Plugin not found: ${pluginId}`,
        };
      }

      const manifest = plugin.manifest as any as PluginManifest;

      // 2. Find action definition
      const action = (manifest as any).actions?.find(
        (a: any) => a.id === actionId
      );

      if (!action) {
        return {
          success: false,
          error: `Action not found: ${actionId}`,
        };
      }

      // 3. Get server for context
      const server = await db.server.findUnique({
        where: { id: request.serverId },
      });

      if (!server) {
        return {
          success: false,
          error: `Server not found: ${request.serverId}`,
        };
      }

      const executorContext: PluginContext = {
        pluginId,
        manifest,
        serverId: request.serverId,
        server,
        config: plugin.config as Record<string, unknown>,
        userId: context.userId,
      };

      // 4. Route to built-in or community plugin handler
      if (plugin.isBuiltIn) {
        // Built-in plugins execute directly in this process
        return await this.executeBuiltInAction(
          actionId,
          request,
          action,
          executorContext
        );
      } else {
        // Community plugins execute in isolated worker process
        return await this.executeCommunityPluginAction(
          pluginId,
          actionId,
          request,
          action,
          executorContext,
          plugin
        );
      }
    } catch (error) {
      console.error(`[Plugin] Action execution failed:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Execute action for built-in plugins (direct execution).
   */
  private async executeBuiltInAction(
    actionId: string,
    request: ExecuteActionRequest,
    action: any,
    context: PluginContext
  ): Promise<ExecuteActionResponse> {
    let executedCount = 0;
    const operations: Operation[] = action.operations || [];
    let backupId: string | null = null;

    // Create backup before destructive operations if requested
    if (PluginActionExecutor.isActionDestructive(action) && request.options?.createBackup) {
      try {
        backupId = await this.createPreActionBackup(context, request.options?.backupName);
        if (backupId) {
          console.log(`[Plugin:${context.pluginId}] Backup created: ${backupId}`);
        }
      } catch (error) {
        return {
          success: false,
          error: `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    for (const operation of operations) {
      try {
        // Resolve template variables in operation
        const resolvedOp = this.resolveOperationTemplates(
          operation,
          request.inputs,
          context
        );

        // Execute based on operation type
        switch (resolvedOp.type) {
          case "download-to-server":
            await this.executeDownload(resolvedOp, context);
            break;
          case "write-file":
            await this.executeWriteFile(resolvedOp, context);
            break;
          case "delete-file":
            await this.executeDeleteFile(resolvedOp, context);
            break;
          case "send-command":
            await this.executeSendCommand(resolvedOp, context);
            break;
          case "restart-server":
            if (!request.options?.skipRestart) {
              await this.executeRestartServer(context);
            }
            break;
          case "stop-server":
            await this.executeStopServer(context);
            break;
          case "start-server":
            await this.executeStartServer(context);
            break;
          case "create-backup":
            if (!request.options?.skipBackup) {
              await this.executeCreateBackup(context);
            }
            break;
          default:
            console.warn(`Unknown operation type: ${resolvedOp.type}`);
        }

        executedCount++;
      } catch (error) {
        console.error(`[Plugin:${context.pluginId}] Operation ${operation.type} failed:`, error);
        return {
          success: false,
          error: `Operation failed: ${operation.type} - ${String(error)}`,
          executedOperations: executedCount,
        };
      }
    }

    return {
      success: true,
      message: `Action completed successfully (${executedCount} operations)`,
      executedOperations: executedCount,
    };
  }

  /**
   * Execute action for community plugins (worker process).
   */
  private async executeCommunityPluginAction(
    pluginId: string,
    actionId: string,
    request: ExecuteActionRequest,
    action: any,
    context: PluginContext,
    pluginRecord: any
  ): Promise<ExecuteActionResponse> {
    try {
      // Get or create worker for this plugin
      // Note: pluginPath would come from gitRepoUrl or installed plugin directory
      const pluginPath = pluginRecord.gitRepoUrl || `/plugins/${pluginId}`;

      const worker = await pluginWorkerPool.getWorker({
        pluginId,
        pluginPath,
        timeout: 30000, // 30 second timeout per action
      });

      console.log(`[Plugin:${pluginId}] Executing action ${actionId} in worker process`);

      // Execute action in worker process
      const result = await worker.executeAction(actionId, {
        serverId: request.serverId,
        inputs: request.inputs,
        options: request.options,
      });

      return {
        success: true,
        message: `Community plugin action executed successfully`,
        data: result,
      };
    } catch (error) {
      console.error(`[Plugin:${pluginId}] Community plugin action failed:`, error);
      return {
        success: false,
        error: `Community plugin action failed: ${String(error)}`,
      };
    }
  }

  /**
   * Check if an action has destructive operations (file writes, deletes, downloads).
   * Destructive operations should prompt for backup before execution.
   */
  static isActionDestructive(action: any): boolean {
    if (!action.operations) return false;

    const destructiveTypes = ["download-to-server", "write-file", "delete-file"];
    return action.operations.some((op: Operation) => destructiveTypes.includes(op.type));
  }

  /**
   * Create a backup before executing destructive operations.
   * Used to protect against accidental data loss.
   */
  private async createPreActionBackup(
    context: PluginContext,
    backupName?: string
  ): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const name =
        backupName ||
        `plugin-${context.pluginId}-${timestamp}-${Date.now().toString().slice(-6)}`;

      console.log(
        `[Plugin:${context.pluginId}] Creating backup "${name}" before destructive operation`
      );

      // TODO: Implement actual backup creation via daemon
      // const backup = await backupManager.create(context.serverId, { name });
      // return backup.id;

      console.warn(
        `[Plugin] Backup creation not yet implemented. Proceeding without backup.`
      );
      return null;
    } catch (error) {
      console.error(`[Plugin] Failed to create backup:`, error);
      throw new Error(
        `Backup creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Resolve template variables in operation parameters.
   * Supports {{inputName}} for user inputs and {{config.keyName}} for config values.
   */
  private resolveOperationTemplates(
    operation: Operation,
    inputs: Record<string, unknown>,
    context: PluginContext
  ): Operation {
    const resolved = { ...operation };

    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === "string") {
        resolved[key] = value
          .replace(/\{\{([^.}]+)\}\}/g, (_, inputName) => {
            const inputValue = inputs[inputName];
            if (inputValue === undefined) {
              throw new Error(`Missing input parameter: ${inputName}`);
            }
            return String(inputValue);
          })
          .replace(/\{\{config\.([^}]+)\}\}/g, (_, configKey) => {
            const configValue = (context.config as any)[configKey];
            if (configValue === undefined) {
              throw new Error(`Missing config value: ${configKey}`);
            }
            return String(configValue);
          });
      }
    }

    return resolved;
  }

  // ============================================
  // Operation Implementations
  // ============================================

  private async executeDownload(
    operation: Operation,
    context: PluginContext
  ): Promise<void> {
    // Download file from URL and write to server
    const { url, destPath, headers = {} } = operation as any;

    if (!url || !destPath) {
      throw new Error("Download operation requires url and destPath");
    }

    // This would normally interact with the daemon to download files
    // For now, we'll log it as a placeholder
    console.log(`[Plugin] Downloading ${url} to ${destPath} on server ${context.serverId}`);

    // TODO: Implement actual file download via daemon
    // const response = await fetch(url, { headers });
    // Write file to server using daemon API
  }

  private async executeWriteFile(
    operation: Operation,
    context: PluginContext
  ): Promise<void> {
    const { path, content, append = false } = operation as any;

    if (!path || !content) {
      throw new Error("Write file operation requires path and content");
    }

    console.log(`[Plugin] Writing file ${path} on server ${context.serverId}`);

    // TODO: Implement file write via daemon
    // Use server file write API with context validation
  }

  private async executeDeleteFile(
    operation: Operation,
    context: PluginContext
  ): Promise<void> {
    const { path } = operation as any;

    if (!path) {
      throw new Error("Delete file operation requires path");
    }

    console.log(`[Plugin] Deleting file ${path} on server ${context.serverId}`);

    // TODO: Implement file delete via daemon
  }

  private async executeSendCommand(
    operation: Operation,
    context: PluginContext
  ): Promise<void> {
    const { command, timeout = 5000 } = operation as any;

    if (!command) {
      throw new Error("Send command operation requires command");
    }

    console.log(`[Plugin] Sending command "${command}" to server ${context.serverId}`);

    // TODO: Implement command execution via daemon
    // Send console command to running server
  }

  private async executeRestartServer(context: PluginContext): Promise<void> {
    console.log(`[Plugin] Restarting server ${context.serverId}`);

    // TODO: Implement server restart via daemon
    // Call daemon restart endpoint
  }

  private async executeStopServer(context: PluginContext): Promise<void> {
    console.log(`[Plugin] Stopping server ${context.serverId}`);

    // TODO: Implement server stop via daemon
  }

  private async executeStartServer(context: PluginContext): Promise<void> {
    console.log(`[Plugin] Starting server ${context.serverId}`);

    // TODO: Implement server start via daemon
  }

  private async executeCreateBackup(context: PluginContext): Promise<void> {
    console.log(`[Plugin] Creating backup for server ${context.serverId}`);

    // TODO: Implement backup creation via daemon
  }

  /**
   * Get required permissions for an action based on its operations.
   * Used by permission enforcement middleware.
   */
  static getActionPermissions(manifest: PluginManifest, actionId: string): string[] {
    const action = (manifest as any).actions?.find((a: any) => a.id === actionId);
    if (!action) return [];

    const permissions = new Set<string>();

    for (const operation of action.operations || []) {
      switch (operation.type) {
        case "download-to-server":
        case "write-file":
        case "delete-file":
          permissions.add("files.*");
          break;
        case "send-command":
          permissions.add("console.send");
          break;
        case "restart-server":
        case "stop-server":
        case "start-server":
          permissions.add("control.*");
          break;
        case "create-backup":
          permissions.add("backups.create");
          break;
      }
    }

    return Array.from(permissions);
  }
}

// Export singleton instance
export const pluginActionExecutor = new PluginActionExecutor();
