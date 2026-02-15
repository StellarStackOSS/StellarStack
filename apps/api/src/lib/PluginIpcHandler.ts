/**
 * StellarStack Plugin IPC Handler
 *
 * Handles IPC messages from plugin worker processes.
 * Processes API requests, enforces permissions, and sends responses back.
 */

import { PluginAPIProxy } from "./PluginApiProxy";

// ============================================
// Types
// ============================================

/** Incoming IPC message from a plugin worker */
interface WorkerIpcMessage {
  type: string;
  requestId: string;
  data?: {
    method?: string;
    endpoint?: string;
    data?: unknown;
    actionId?: string;
    request?: Record<string, unknown>;
  };
  level?: string;
  text?: string;
}

/** Outgoing IPC response to a plugin worker */
interface WorkerIpcResponse {
  type: "success" | "error";
  requestId: string;
  data?: unknown;
  error?: string;
}

// ============================================
// IPC Message Handler
// ============================================

export class PluginIPCHandler {
  /**
   * Handle a message from a plugin worker process
   */
  static async handleWorkerMessage(
    pluginId: string,
    message: WorkerIpcMessage,
    sendResponse: (response: WorkerIpcResponse) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case "api-request":
          await this.handleAPIRequest(pluginId, message, sendResponse);
          break;

        case "action-execution":
          await this.handleActionExecution(pluginId, message, sendResponse);
          break;

        case "log":
          this.handleLog(pluginId, message);
          break;

        default:
          sendResponse({
            type: "error",
            requestId: message.requestId,
            error: `Unknown message type: ${message.type}`,
          });
      }
    } catch (error) {
      sendResponse({
        type: "error",
        requestId: message.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle API request from worker
   */
  private static async handleAPIRequest(
    pluginId: string,
    message: WorkerIpcMessage,
    sendResponse: (response: WorkerIpcResponse) => void
  ): Promise<void> {
    const { method, endpoint, data } = message.data || {};

    try {
      // Execute API call with permission checking
      const result = await PluginAPIProxy.executeAPICall(
        pluginId,
        method || "",
        endpoint || "",
        data
      );

      sendResponse({
        type: "success",
        requestId: message.requestId,
        data: result,
      });
    } catch (error) {
      sendResponse({
        type: "error",
        requestId: message.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle action execution request from worker
   */
  private static async handleActionExecution(
    pluginId: string,
    message: WorkerIpcMessage,
    sendResponse: (response: WorkerIpcResponse) => void
  ): Promise<void> {
    const { actionId, request } = message.data || {};

    try {
      // In a real implementation, execute the action here
      const result = {
        success: true,
        actionId,
        message: "Action executed by worker",
      };

      sendResponse({
        type: "success",
        requestId: message.requestId,
        data: result,
      });
    } catch (error) {
      sendResponse({
        type: "error",
        requestId: message.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle log messages from worker
   */
  private static handleLog(pluginId: string, message: WorkerIpcMessage): void {
    const level = message.level || "info";
    const text = message.text || "";
    console.log(`[Plugin:${pluginId}:${level.toUpperCase()}] ${text}`);
  }
}
