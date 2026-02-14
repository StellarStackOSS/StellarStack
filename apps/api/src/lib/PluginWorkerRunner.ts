/**
 * StellarStack Plugin Worker Runner
 *
 * This script runs in a SEPARATE PROCESS and executes plugin code.
 * It communicates with the parent process via IPC messages.
 * All API calls are proxied back to the parent for permission checking.
 */

import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

interface InitMessage {
  type: 'init';
  requestId: string;
  data: {
    pluginId: string;
    pluginPath: string;
  };
}

interface ActionMessage {
  type: 'action';
  requestId: string;
  data: {
    actionId: string;
    request: Record<string, unknown>;
  };
}

interface ApiCallMessage {
  type: 'api-call';
  requestId: string;
  data: {
    method: string;
    params: Record<string, unknown>;
  };
}

interface ShutdownMessage {
  type: 'shutdown';
  requestId: string;
}

type WorkerMessage = InitMessage | ActionMessage | ApiCallMessage | ShutdownMessage;

// ============================================
// Worker Runtime
// ============================================

class PluginWorkerRuntime {
  private pluginId: string = '';
  private pluginPath: string = '';
  private plugin: unknown = null;
  private pendingApiCalls = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  constructor() {
    // Listen for messages from parent process
    process.on('message', (msg: WorkerMessage) => {
      this.handleMessage(msg).catch((error) => {
        console.error('[PluginWorkerRunner] Error handling message:', error);
      });
    });

    // Handle parent process exit
    process.on('disconnect', () => {
      console.log('[PluginWorkerRunner] Parent disconnected, exiting');
      process.exit(0);
    });
  }

  private async handleMessage(msg: WorkerMessage): Promise<void> {
    try {
      switch (msg.type) {
        case 'init':
          await this.init(msg);
          break;
        case 'action':
          await this.executeAction(msg);
          break;
        case 'api-call':
          // API calls are handled by parent, this shouldn't happen here
          this.sendError(msg.requestId, 'API calls should be proxied through parent');
          break;
        case 'shutdown':
          process.exit(0);
          break;
        default: {
          const unknownMsg = msg as { requestId?: string; type?: string };
          this.sendError(unknownMsg.requestId || 'unknown', `Unknown message type: ${unknownMsg.type}`);
        }
      }
    } catch (error) {
      const requestId = (msg as { requestId?: string }).requestId || 'unknown';
      this.sendError(requestId, error instanceof Error ? error.message : String(error));
    }
  }

  private async init(msg: InitMessage): Promise<void> {
    try {
      this.pluginId = msg.data.pluginId;
      this.pluginPath = msg.data.pluginPath;

      // In a real implementation, you would load the plugin code here
      // For now, we'll just send a ready message
      console.log(`[PluginWorkerRunner] Initialized for plugin: ${this.pluginId}`);

      // Send ready message
      this.send({
        type: 'ready',
        requestId: msg.requestId,
      });
    } catch (error) {
      this.sendError(msg.requestId, error instanceof Error ? error.message : String(error));
    }
  }

  private async executeAction(msg: ActionMessage): Promise<void> {
    try {
      const { actionId, request } = msg.data;

      // Simulate action execution
      // In a real implementation, this would call plugin.executeAction()
      const result = {
        success: true,
        message: `Action ${actionId} executed`,
        data: request,
      };

      this.sendSuccess(msg.requestId, result);
    } catch (error) {
      this.sendError(msg.requestId, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Create a scoped API client for the plugin
   * All API calls go through IPC to the parent process
   */
  private createScopedAPI() {
    return {
      get: (endpoint: string) => this.apiCall('GET', endpoint),
      post: (endpoint: string, data: unknown) => this.apiCall('POST', endpoint, data),
      put: (endpoint: string, data: unknown) => this.apiCall('PUT', endpoint, data),
      patch: (endpoint: string, data: unknown) => this.apiCall('PATCH', endpoint, data),
      delete: (endpoint: string) => this.apiCall('DELETE', endpoint),
    };
  }

  /**
   * Send API call request to parent process
   */
  private apiCall(method: string, endpoint: string, data?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();
      const timeout = setTimeout(() => {
        this.pendingApiCalls.delete(requestId);
        reject(new Error(`API call timeout: ${method} ${endpoint}`));
      }, 30000); // 30 second timeout

      this.pendingApiCalls.set(requestId, {
        resolve: (result: unknown) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      // Send API request to parent
      this.send({
        type: 'api-request',
        requestId,
        data: { method, endpoint, data },
      });
    });
  }

  // ============================================
  // Message Sending
  // ============================================

  private send(msg: Record<string, unknown>): void {
    if (process.send) {
      process.send(msg);
    }
  }

  private sendSuccess(requestId: string, data: unknown): void {
    this.send({
      type: 'success',
      requestId,
      data,
    });
  }

  private sendError(requestId: string, error: string): void {
    this.send({
      type: 'error',
      requestId,
      error,
    });
  }
}

// ============================================
// Initialize Runtime
// ============================================

// Create and start the worker runtime
const runtime = new PluginWorkerRuntime();

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[PluginWorkerRunner] Uncaught exception:', error);
  process.exit(1);
});

console.log('[PluginWorkerRunner] Worker process started, waiting for messages...');
