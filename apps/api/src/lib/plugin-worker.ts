/**
 * StellarStack Plugin Worker Manager
 *
 * Manages isolated worker processes for community plugins.
 * Provides IPC-based communication, permission enforcement, and resource limits.
 */

import { fork, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

export interface WorkerOptions {
  pluginId: string;
  pluginPath: string;
  timeout?: number; // milliseconds
  maxMemory?: number; // MB
}

export interface PluginRequest {
  type: 'action' | 'api-call' | 'init' | 'shutdown';
  requestId: string;
  data?: any;
}

export interface PluginResponse {
  type: 'success' | 'error' | 'ready';
  requestId: string;
  data?: any;
  error?: string;
}

// ============================================
// Plugin Worker
// ============================================

export class PluginWorker {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();
  private pluginId: string;
  private pluginPath: string;
  private timeout: number;
  private isReady = false;

  constructor(options: WorkerOptions) {
    this.pluginId = options.pluginId;
    this.pluginPath = options.pluginPath;
    this.timeout = options.timeout || 30000; // 30 second default timeout
  }

  /**
   * Start the worker process
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Fork the worker runner in a separate process
        this.process = fork(`${__dirname}/plugin-worker-runner.js`, [], {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          detached: false,
          timeout: this.timeout,
        });

        // Handle IPC messages from worker
        this.process.on('message', (msg: PluginResponse) => {
          this.handleWorkerMessage(msg);
        });

        // Handle worker errors
        this.process.on('error', (error) => {
          console.error(`[PluginWorker] Worker error for ${this.pluginId}:`, error);
          reject(error);
        });

        // Handle worker exit
        this.process.on('exit', (code, signal) => {
          console.log(`[PluginWorker] Worker process exited: code=${code}, signal=${signal}`);
          this.isReady = false;
          this.process = null;
        });

        // Initialize the worker
        this.sendMessage({
          type: 'init',
          requestId: randomUUID(),
          data: {
            pluginId: this.pluginId,
            pluginPath: this.pluginPath,
          },
        });

        // Wait for ready message
        const initTimer = setTimeout(() => {
          reject(new Error('Plugin worker initialization timeout'));
        }, 10000);

        const checkReady = setInterval(() => {
          if (this.isReady) {
            clearInterval(checkReady);
            clearTimeout(initTimer);
            resolve();
          }
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute a plugin action
   */
  async executeAction(
    actionId: string,
    request: any
  ): Promise<any> {
    if (!this.isReady) {
      throw new Error('Plugin worker not ready');
    }

    return this.sendRequestAndWait({
      type: 'action',
      requestId: randomUUID(),
      data: {
        actionId,
        request,
      },
    });
  }

  /**
   * Make an API call through the worker (will be proxied through parent)
   */
  async apiCall(method: string, params: any): Promise<any> {
    if (!this.isReady) {
      throw new Error('Plugin worker not ready');
    }

    return this.sendRequestAndWait({
      type: 'api-call',
      requestId: randomUUID(),
      data: {
        method,
        params,
      },
    });
  }

  /**
   * Stop the worker process
   */
  stop(): void {
    if (this.process) {
      console.log(`[PluginWorker] Stopping worker for ${this.pluginId}`);
      this.process.kill('SIGTERM');
      this.isReady = false;

      // Clean up pending requests
      for (const [, { timer }] of this.pendingRequests) {
        clearTimeout(timer);
      }
      this.pendingRequests.clear();
    }
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  // ============================================
  // Private Methods
  // ============================================

  private sendMessage(msg: PluginRequest): void {
    if (this.process && !this.process.killed) {
      this.process.send(msg);
    }
  }

  private sendRequestAndWait(msg: PluginRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = msg.requestId;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Plugin worker request timeout: ${requestId}`));
      }, this.timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      this.sendMessage(msg);
    });
  }

  private handleWorkerMessage(msg: PluginResponse): void {
    if (msg.type === 'ready') {
      this.isReady = true;
      console.log(`[PluginWorker] Plugin ${this.pluginId} worker ready`);
      return;
    }

    const request = this.pendingRequests.get(msg.requestId);
    if (!request) {
      console.warn(`[PluginWorker] Received response for unknown request: ${msg.requestId}`);
      return;
    }

    clearTimeout(request.timer);
    this.pendingRequests.delete(msg.requestId);

    if (msg.type === 'success') {
      request.resolve(msg.data);
    } else if (msg.type === 'error') {
      request.reject(new Error(msg.error || 'Unknown worker error'));
    }
  }
}

// ============================================
// Plugin Worker Pool
// ============================================

export class PluginWorkerPool {
  private workers = new Map<string, PluginWorker>();
  private maxWorkers = 10;

  /**
   * Get or create a worker for a plugin
   */
  async getWorker(options: WorkerOptions): Promise<PluginWorker> {
    let worker = this.workers.get(options.pluginId);

    if (!worker) {
      if (this.workers.size >= this.maxWorkers) {
        throw new Error(`Plugin worker pool at maximum capacity (${this.maxWorkers})`);
      }

      worker = new PluginWorker(options);
      this.workers.set(options.pluginId, worker);
      await worker.start();
    }

    return worker;
  }

  /**
   * Stop a worker
   */
  stopWorker(pluginId: string): void {
    const worker = this.workers.get(pluginId);
    if (worker) {
      worker.stop();
      this.workers.delete(pluginId);
    }
  }

  /**
   * Stop all workers
   */
  stopAll(): void {
    for (const [pluginId, worker] of this.workers) {
      worker.stop();
    }
    this.workers.clear();
  }

  /**
   * Get active worker count
   */
  getActiveCount(): number {
    return Array.from(this.workers.values()).filter((w) => w.isRunning()).length;
  }
}

// Global worker pool instance
export const pluginWorkerPool = new PluginWorkerPool();
