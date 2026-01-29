/**
 * Auto-shutdown background job
 *
 * Periodically checks for RUNNING servers that have exceeded their inactivity
 * timeout and automatically stops them. Supports both:
 *   1. Per-server auto-shutdown (set via API when creating/updating a server)
 *   2. Global auto-shutdown (admin setting that applies to all servers)
 *
 * Per-server settings take precedence over global settings:
 *   - autoShutdownEnabled=true  -> always auto-shutdown (per-server timeout or global fallback)
 *   - autoShutdownEnabled=false -> never auto-shutdown (exempt from global)
 *   - autoShutdownEnabled=null  -> inherit from global setting (default for new servers)
 *
 * The inactivity timer is based on the `lastActivityAt` field, which is
 * updated when:
 *   - The server transitions to RUNNING
 *   - A console command is sent
 *   - A power action (start/restart) is performed
 */

import { db } from "./db";
import { emitServerEvent } from "./ws";
import { logActivity, ActivityEvents } from "./activity";
import { dispatchWebhook, WebhookEvents } from "./webhooks";
import { pluginManager } from "./plugin-manager";
import { validateNodeConfig } from "../middleware/security";
import type { AutoShutdownSettings } from "../routes/settings.types";

// Check interval: 60 seconds
const CHECK_INTERVAL_MS = 60_000;

let checkInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Helper to communicate with daemon (duplicated from servers.ts to avoid
 * circular dependency; kept minimal for the stop action only)
 */
const daemonStopServer = async (
  node: { id: string; host: string; port: number; protocol: string; token: string },
  serverId: string
): Promise<void> => {
  validateNodeConfig(node);

  const protocol = node.protocol === "HTTPS" || node.protocol === "HTTPS_PROXY" ? "https" : "http";
  const url = `${protocol}://${node.host}:${node.port}/api/servers/${serverId}/power`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${node.id}.${node.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "stop" }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Daemon error: ${error}`);
  }
};

/**
 * Fetch the global auto-shutdown settings from the database
 */
const getGlobalAutoShutdownSettings = async (): Promise<AutoShutdownSettings> => {
  const setting = await db.settings.findUnique({
    where: { key: "autoShutdown" },
  });
  return (setting?.value as unknown as AutoShutdownSettings) ?? { enabled: false, timeout: 60 };
};

/**
 * Run a single auto-shutdown check cycle
 */
const runAutoShutdownCheck = async (): Promise<void> => {
  try {
    const globalSettings = await getGlobalAutoShutdownSettings();

    // Find all RUNNING servers that are candidates for auto-shutdown
    // A server is a candidate if:
    //   1. It has per-server autoShutdownEnabled=true, OR
    //   2. The global setting is enabled (and the server hasn't explicitly disabled it)
    const runningServers = await db.server.findMany({
      where: {
        status: "RUNNING",
        suspended: false,
      },
      include: {
        node: true,
      },
    });

    if (runningServers.length === 0) return;

    const now = new Date();

    for (const server of runningServers) {
      // Cast to any to access new Prisma fields before client regeneration
      const srv = server as any;

      try {
        // Determine if auto-shutdown applies to this server and what timeout to use
        // autoShutdownEnabled is a three-state nullable boolean:
        //   null  = not configured (inherit global setting)
        //   true  = explicitly enabled for this server
        //   false = explicitly disabled for this server (exempt from global)
        let timeoutMinutes: number;

        if (srv.autoShutdownEnabled === true) {
          // Per-server auto-shutdown is explicitly enabled
          timeoutMinutes = srv.autoShutdownTimeout ?? globalSettings.timeout;
        } else if (srv.autoShutdownEnabled === false) {
          // Per-server auto-shutdown is explicitly disabled -- skip regardless of global
          continue;
        } else if (globalSettings.enabled) {
          // autoShutdownEnabled is null (not configured) and global is enabled
          timeoutMinutes = globalSettings.timeout;
        } else {
          // Not configured per-server and global is disabled
          continue;
        }

        // Determine the reference time for inactivity
        // Use lastActivityAt if available, otherwise fall back to updatedAt
        const referenceTime: Date = srv.lastActivityAt || server.updatedAt;
        const elapsedMs = now.getTime() - referenceTime.getTime();
        const elapsedMinutes = elapsedMs / (1000 * 60);

        if (elapsedMinutes < timeoutMinutes) {
          // Server is still within the allowed inactivity window
          continue;
        }

        // Server has exceeded the inactivity timeout -- stop it
        // Emit plugin hook before auto-shutdown stop
        await pluginManager.getHookRegistry().emit("server:beforeStop", {
          serverId: server.id,
          data: {
            action: "auto-shutdown",
            reason: "inactivity",
            inactiveMinutes: Math.round(elapsedMinutes),
          },
        });

        if (!server.node.isOnline) {
          console.warn(
            `[Auto-Shutdown] Node ${server.node.displayName} is offline, cannot stop server ${server.id} (${server.name})`
          );
          continue;
        }

        console.log(
          `[Auto-Shutdown] Stopping server ${server.id} (${server.name}) after ${Math.round(elapsedMinutes)} minutes of inactivity (timeout: ${timeoutMinutes}m)`
        );

        // Send stop command to daemon
        await daemonStopServer(server.node, server.id);

        // Update server status
        await db.server.update({
          where: { id: server.id },
          data: { status: "STOPPING" },
        });

        // Emit plugin hook after auto-shutdown stop
        pluginManager
          .getHookRegistry()
          .emit("server:afterStop", {
            serverId: server.id,
            data: { action: "auto-shutdown", reason: "inactivity", status: "STOPPING" },
          })
          .catch(() => {});

        // Emit WebSocket event
        emitServerEvent("server:status", server.id, {
          id: server.id,
          status: "STOPPING",
        });

        // Log activity
        await logActivity({
          event: ActivityEvents.SERVER_AUTO_SHUTDOWN,
          serverId: server.id,
          metadata: {
            reason: "inactivity",
            inactiveMinutes: Math.round(elapsedMinutes),
            timeoutMinutes,
            source: srv.autoShutdownEnabled ? "per-server" : "global",
          },
        });

        // Dispatch webhook (fire and forget)
        dispatchWebhook(WebhookEvents.SERVER_AUTO_SHUTDOWN, {
          serverId: server.id,
          data: {
            reason: "inactivity",
            inactiveMinutes: Math.round(elapsedMinutes),
            timeoutMinutes,
          },
        }).catch(() => {});
      } catch (error) {
        console.error(
          `[Auto-Shutdown] Failed to stop server ${server.id} (${server.name}):`,
          error
        );
      }
    }
  } catch (error) {
    console.error("[Auto-Shutdown] Error during auto-shutdown check:", error);
  }
};

/**
 * Start the auto-shutdown background checker
 */
export const startAutoShutdownChecker = (): void => {
  if (checkInterval) return;

  console.log("[Auto-Shutdown] Starting auto-shutdown checker (interval: 60s)");

  checkInterval = setInterval(() => {
    runAutoShutdownCheck();
  }, CHECK_INTERVAL_MS);

  // Don't block process exit
  if (checkInterval.unref) {
    checkInterval.unref();
  }
};

/**
 * Stop the auto-shutdown background checker
 */
export const stopAutoShutdownChecker = (): void => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("[Auto-Shutdown] Stopped auto-shutdown checker");
  }
};
