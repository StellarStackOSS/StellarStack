/**
 * Daemon API Client
 *
 * Provides a client for communicating with the StellarStack daemon
 * for plugin operations like file downloads, writes, backups, and server control.
 */

import { db } from "./db";

// ============================================
// Types
// ============================================

export interface DaemonPluginDownloadRequest {
  url: string;
  dest_path: string;
  directory?: string;
  decompress?: boolean;
  headers?: Record<string, string>;
  max_size?: number;
}

export interface DaemonPluginWriteRequest {
  path: string;
  content: string;
  append?: boolean;
  mode?: string;
}

export interface DaemonPluginDeleteRequest {
  path: string;
  recursive?: boolean;
}

export interface DaemonPluginBackupRequest {
  name: string;
  description?: string;
}

export interface DaemonPluginControlRequest {
  action: "start" | "stop" | "restart";
  timeout?: number;
  force?: boolean;
}

export interface DaemonPluginCommandRequest {
  command: string;
  timeout?: number;
}

export interface DaemonResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// ============================================
// Daemon Client
// ============================================

export class DaemonClient {
  /**
   * Get the daemon URL for a specific server
   */
  private static async getDaemonUrl(serverId: string): Promise<string> {
    // Get server with its node information
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: {
        node: true,
      },
    });

    if (!server || !server.node) {
      throw new Error(`Server or node not found for server ${serverId}`);
    }

    // Get node's daemon URL from config
    const protocol = server.node.protocol.toLowerCase();
    const port = server.node.port || 8080;
    return `${protocol}://${server.node.host}:${port}`;
  }

  /**
   * Get the authentication token for the daemon
   */
  private static async getDaemonToken(serverId: string): Promise<string> {
    // Get server's node token (authentication)
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: { node: true },
    });

    if (!server || !server.node || !server.node.token) {
      throw new Error("Daemon authentication token not found");
    }

    return server.node.token;
  }

  /**
   * Download a file from URL to the server
   */
  static async downloadFile(
    serverId: string,
    request: DaemonPluginDownloadRequest
  ): Promise<DaemonResponse> {
    const daemonUrl = await this.getDaemonUrl(serverId);
    const token = await this.getDaemonToken(serverId);

    const response = await fetch(
      `${daemonUrl}/api/servers/${serverId}/plugins/download`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Download failed");
    }

    return response.json();
  }

  /**
   * Write content to a file on the server
   */
  static async writeFile(
    serverId: string,
    request: DaemonPluginWriteRequest
  ): Promise<DaemonResponse> {
    const daemonUrl = await this.getDaemonUrl(serverId);
    const token = await this.getDaemonToken(serverId);

    const response = await fetch(
      `${daemonUrl}/api/servers/${serverId}/plugins/write`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Write failed");
    }

    return response.json();
  }

  /**
   * Delete a file or directory on the server
   */
  static async deleteFile(
    serverId: string,
    request: DaemonPluginDeleteRequest
  ): Promise<DaemonResponse> {
    const daemonUrl = await this.getDaemonUrl(serverId);
    const token = await this.getDaemonToken(serverId);

    const response = await fetch(
      `${daemonUrl}/api/servers/${serverId}/plugins/delete`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Delete failed");
    }

    return response.json();
  }

  /**
   * Create a backup of the server before destructive operations
   */
  static async createBackup(
    serverId: string,
    request: DaemonPluginBackupRequest
  ): Promise<{ success: boolean; backup_id: string; name: string }> {
    const daemonUrl = await this.getDaemonUrl(serverId);
    const token = await this.getDaemonToken(serverId);

    const response = await fetch(
      `${daemonUrl}/api/servers/${serverId}/plugins/backup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Backup creation failed");
    }

    return response.json();
  }

  /**
   * Control server operations (start, stop, restart)
   */
  static async controlServer(
    serverId: string,
    request: DaemonPluginControlRequest
  ): Promise<DaemonResponse> {
    const daemonUrl = await this.getDaemonUrl(serverId);
    const token = await this.getDaemonToken(serverId);

    const response = await fetch(
      `${daemonUrl}/api/servers/${serverId}/plugins/control`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Server control failed");
    }

    return response.json();
  }

  /**
   * Send a console command to the server
   */
  static async sendCommand(
    serverId: string,
    request: DaemonPluginCommandRequest
  ): Promise<DaemonResponse> {
    const daemonUrl = await this.getDaemonUrl(serverId);
    const token = await this.getDaemonToken(serverId);

    const response = await fetch(
      `${daemonUrl}/api/servers/${serverId}/plugins/command`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Command send failed");
    }

    return response.json();
  }
}
