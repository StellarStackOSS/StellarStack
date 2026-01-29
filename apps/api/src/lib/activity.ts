import type { Context } from "hono";
import { db } from "./db";
import type { ActivityEvent, LogActivityOptions, ActivityLogQuery } from "./activity.types";

// Re-export types for backwards compatibility
export type { ActivityEvent, LogActivityOptions, ActivityLogQuery } from "./activity.types";

/**
 * Activity event types for server operations
 */
export const ActivityEvents = {
  // Server power actions
  SERVER_START: "server:power.start",
  SERVER_STOP: "server:power.stop",
  SERVER_RESTART: "server:power.restart",
  SERVER_KILL: "server:power.kill",
  SERVER_AUTO_SHUTDOWN: "server:power.auto-shutdown",

  // Server console
  CONSOLE_COMMAND: "server:console.command",

  // Server settings
  SERVER_CREATE: "server:settings.create",
  SERVER_UPDATE: "server:settings.update",
  SERVER_DELETE: "server:settings.delete",
  SERVER_REINSTALL: "server:settings.reinstall",
  STARTUP_UPDATE: "server:startup.update",

  // File operations
  FILE_READ: "server:file.read",
  FILE_WRITE: "server:file.write",
  FILE_DELETE: "server:file.delete",
  FILE_RENAME: "server:file.rename",
  FILE_COPY: "server:file.copy",
  FILE_COMPRESS: "server:file.compress",
  FILE_DECOMPRESS: "server:file.decompress",
  FILE_UPLOAD: "server:file.upload",
  FILE_DOWNLOAD: "server:file.download",

  // Directory operations
  DIRECTORY_CREATE: "server:directory.create",
  DIRECTORY_DELETE: "server:directory.delete",

  // Backup operations
  BACKUP_CREATE: "server:backup.create",
  BACKUP_DELETE: "server:backup.delete",
  BACKUP_RESTORE: "server:backup.restore",
  BACKUP_DOWNLOAD: "server:backup.download",
  BACKUP_LOCK: "server:backup.lock",
  BACKUP_UNLOCK: "server:backup.unlock",

  // Schedule operations
  SCHEDULE_CREATED: "server:schedule.created",
  SCHEDULE_UPDATED: "server:schedule.updated",
  SCHEDULE_DELETED: "server:schedule.deleted",
  SCHEDULE_TRIGGERED: "server:schedule.triggered",

  // Allocation operations
  ALLOCATION_ADD: "server:allocation.add",
  ALLOCATION_REMOVE: "server:allocation.remove",
  ALLOCATION_PRIMARY: "server:allocation.primary",

  // Transfer operations
  TRANSFER_START: "server:transfer.start",
  TRANSFER_COMPLETE: "server:transfer.complete",
  TRANSFER_FAIL: "server:transfer.fail",

  // Split operations
  SPLIT_CREATE: "server:split.create",
  SPLIT_DELETE: "server:split.delete",

  // User account events
  USER_LOGIN: "user:auth.login",
  USER_LOGOUT: "user:auth.logout",
  USER_PASSWORD_CHANGE: "user:auth.password-change",
  USER_2FA_ENABLE: "user:auth.2fa-enable",
  USER_2FA_DISABLE: "user:auth.2fa-disable",
  USER_PASSKEY_ADD: "user:auth.passkey-add",
  USER_PASSKEY_REMOVE: "user:auth.passkey-remove",

  // Webhook events
  WEBHOOK_CREATE: "server:webhook.create",
  WEBHOOK_UPDATE: "server:webhook.update",
  WEBHOOK_DELETE: "server:webhook.delete",
} as const;

/**
 * Log an activity to the database
 */
export const logActivity = async (options: LogActivityOptions): Promise<void> => {
  try {
    await db.activityLog.create({
      data: {
        event: options.event,
        serverId: options.serverId || null,
        userId: options.userId || null,
        ip: options.ip || null,
        metadata: options.metadata || undefined,
      },
    });
  } catch (error) {
    // Don't let activity logging failures break the request
    console.error("Failed to log activity:", error);
  }
};

/**
 * Get client IP address from request
 */
export const getClientIp = (c: Context): string | undefined => {
  // Check common proxy headers first
  const xForwardedFor = c.req.header("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = c.req.header("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }

  // Fall back to CF-Connecting-IP for Cloudflare
  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return undefined;
};

/**
 * Helper to log activity from a Hono context
 * Automatically extracts user ID and IP
 */
export const logActivityFromContext = async (
  c: Context,
  event: ActivityEvent | string,
  options: {
    serverId?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> => {
  const user = c.get("user");
  const server = c.get("server");

  await logActivity({
    event,
    serverId: options.serverId || server?.id,
    userId: user?.id,
    ip: getClientIp(c),
    metadata: options.metadata,
  });
};

/**
 * Query activity logs with filtering and pagination
 */
export const queryActivityLogs = async (query: ActivityLogQuery) => {
  const where: any = {};

  if (query.serverId) {
    where.serverId = query.serverId;
  }

  if (query.userId) {
    where.userId = query.userId;
  }

  if (query.event) {
    where.event = query.event;
  }

  if (query.eventPrefix) {
    where.event = {
      startsWith: query.eventPrefix,
    };
  }

  if (query.startDate || query.endDate) {
    where.timestamp = {};
    if (query.startDate) {
      where.timestamp.gte = query.startDate;
    }
    if (query.endDate) {
      where.timestamp.lte = query.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: query.limit || 50,
      skip: query.offset || 0,
    }),
    db.activityLog.count({ where }),
  ]);

  return { logs, total };
};
