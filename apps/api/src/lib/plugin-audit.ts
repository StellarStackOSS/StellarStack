/**
 * StellarStack Plugin Audit Logging
 *
 * Logs all plugin actions for compliance, security monitoring, and debugging.
 * Includes permission checks, execution results, and parameter tracking.
 */

import { db } from "./db";

// ============================================
// Types
// ============================================

export interface PluginAuditEntry {
  pluginId: string;
  actionId: string;
  userId: string;
  serverId?: string;
  params: Record<string, unknown>;
  result: "success" | "error" | "denied";
  denialReason?: string;
  errorMessage?: string;
  executedOperations?: number;
  duration: number; // milliseconds
  timestamp: Date;
}

export interface PluginAuditFilter {
  pluginId?: string;
  userId?: string;
  serverId?: string;
  result?: "success" | "error" | "denied";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// Audit Logger
// ============================================

export class PluginAuditLogger {
  /**
   * Log a plugin action execution.
   */
  async logAction(entry: PluginAuditEntry): Promise<void> {
    try {
      await db.pluginAuditLog.create({
        data: {
          pluginId: entry.pluginId,
          actionId: entry.actionId,
          userId: entry.userId,
          serverId: entry.serverId || null,
          params: entry.params as any,
          result: entry.result,
          denialReason: entry.denialReason,
          error: entry.errorMessage,
          executedOperations: entry.executedOperations,
          duration: entry.duration,
          timestamp: entry.timestamp,
        },
      });
    } catch (error) {
      console.error("[AuditLog] Failed to log plugin action:", error);
      // Don't throw - audit logging failure shouldn't break the action
    }
  }

  /**
   * Log an action that was denied due to permissions.
   */
  async logDeniedAction(
    pluginId: string,
    actionId: string,
    userId: string,
    serverId: string | undefined,
    denialReason: string
  ): Promise<void> {
    await this.logAction({
      pluginId,
      actionId,
      userId,
      serverId,
      params: {},
      result: "denied",
      denialReason,
      duration: 0,
      timestamp: new Date(),
    });
  }

  /**
   * Query audit log with filtering.
   */
  async queryAuditLog(filter: PluginAuditFilter = {}) {
    const where: any = {};

    if (filter.pluginId) where.pluginId = filter.pluginId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.serverId) where.serverId = filter.serverId;
    if (filter.result) where.result = filter.result;

    if (filter.startDate || filter.endDate) {
      where.timestamp = {};
      if (filter.startDate) where.timestamp.gte = filter.startDate;
      if (filter.endDate) where.timestamp.lte = filter.endDate;
    }

    const entries = await db.pluginAuditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filter.limit || 100,
      skip: filter.offset || 0,
    });

    return entries;
  }

  /**
   * Get statistics about plugin actions.
   */
  async getPluginStatistics(pluginId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const entries = await db.pluginAuditLog.findMany({
      where: {
        pluginId,
        timestamp: { gte: since },
      },
    });

    const stats = {
      totalActions: entries.length,
      successCount: entries.filter((e) => e.result === "success").length,
      errorCount: entries.filter((e) => e.result === "error").length,
      deniedCount: entries.filter((e) => e.result === "denied").length,
      averageDuration:
        entries.length > 0
          ? entries.reduce((sum, e) => sum + e.duration, 0) / entries.length
          : 0,
      lastAction: entries[0]?.timestamp,
      topUsers: this.getTopUsers(entries),
      topServers: this.getTopServers(entries),
      errorRate: entries.length > 0 ? (entries.filter((e) => e.result === "error").length / entries.length) * 100 : 0,
    };

    return stats;
  }

  /**
   * Get suspicious activity patterns.
   */
  async detectSuspiciousActivity(
    pluginId: string,
    options = {
      deniedThreshold: 5, // alert if 5+ denied actions in 1 hour
      errorThreshold: 10, // alert if 10+ errors in 1 hour
    }
  ) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const deniedActions = await db.pluginAuditLog.findMany({
      where: {
        pluginId,
        result: "denied",
        timestamp: { gte: oneHourAgo },
      },
    });

    const errorActions = await db.pluginAuditLog.findMany({
      where: {
        pluginId,
        result: "error",
        timestamp: { gte: oneHourAgo },
      },
    });

    const alerts: Array<{
      type: "denied" | "error";
      severity: "warning" | "critical";
      message: string;
      count: number;
      recentEntries: any[];
    }> = [];

    if (deniedActions.length >= options.deniedThreshold) {
      alerts.push({
        type: "denied",
        severity: deniedActions.length >= options.deniedThreshold * 2 ? "critical" : "warning",
        message: `Multiple permission denied errors (${deniedActions.length} in last hour)`,
        count: deniedActions.length,
        recentEntries: deniedActions.slice(0, 5),
      });
    }

    if (errorActions.length >= options.errorThreshold) {
      alerts.push({
        type: "error",
        severity: errorActions.length >= options.errorThreshold * 2 ? "critical" : "warning",
        message: `Multiple errors (${errorActions.length} in last hour)`,
        count: errorActions.length,
        recentEntries: errorActions.slice(0, 5),
      });
    }

    return alerts;
  }

  /**
   * Export audit log for compliance.
   */
  async exportAuditLog(filter: PluginAuditFilter = {}): Promise<string> {
    const entries = await this.queryAuditLog({ ...filter, limit: 100000 });

    // Convert to CSV
    const headers = [
      "Timestamp",
      "Plugin ID",
      "Action ID",
      "User ID",
      "Server ID",
      "Result",
      "Duration (ms)",
      "Error Message",
      "Denial Reason",
    ];

    const rows = entries.map((e) => [
      e.timestamp.toISOString(),
      e.pluginId,
      e.actionId,
      e.userId,
      e.serverId || "",
      e.result,
      e.duration,
      e.error || "",
      e.denialReason || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => (typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell)).join(",")
      ),
    ].join("\n");

    return csv;
  }

  // ============================================
  // Private Helpers
  // ============================================

  private getTopUsers(
    entries: Array<{ userId: string; result: string }>
  ): Array<{ userId: string; count: number }> {
    const userCounts: Record<string, number> = {};

    for (const entry of entries) {
      userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
    }

    return Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getTopServers(
    entries: Array<{ serverId: string | null }>
  ): Array<{ serverId: string; count: number }> {
    const serverCounts: Record<string, number> = {};

    for (const entry of entries) {
      if (entry.serverId) {
        serverCounts[entry.serverId] = (serverCounts[entry.serverId] || 0) + 1;
      }
    }

    return Object.entries(serverCounts)
      .map(([serverId, count]) => ({ serverId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

// Export singleton instance
export const pluginAuditLogger = new PluginAuditLogger();
