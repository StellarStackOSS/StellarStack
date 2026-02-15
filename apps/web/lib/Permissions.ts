/**
 * StellarStack Permission Nodes (Frontend)
 *
 * This file mirrors the API permission definitions for frontend use.
 */

export const PERMISSION_CATEGORIES = {
  CONTROL: "control",
  CONSOLE: "console",
  FILES: "files",
  BACKUPS: "backups",
  ALLOCATIONS: "allocations",
  STARTUP: "startup",
  SETTINGS: "settings",
  ACTIVITY: "activity",
  SCHEDULES: "schedules",
  USERS: "users",
  DATABASE: "database",
  SPLIT: "split",
} as const;

export const PERMISSIONS = {
  // Control permissions - server power actions
  CONTROL_START: "control.start",
  CONTROL_STOP: "control.stop",
  CONTROL_RESTART: "control.restart",
  CONTROL_KILL: "control.kill",

  // Console permissions
  CONSOLE_READ: "console.read",
  CONSOLE_WRITE: "console.write",

  // Files permissions
  FILES_READ: "files.read",
  FILES_WRITE: "files.write",
  FILES_CREATE: "files.create",
  FILES_DELETE: "files.delete",
  FILES_ARCHIVE: "files.archive",
  FILES_SFTP: "files.sftp",

  // Backups permissions
  BACKUPS_READ: "backups.read",
  BACKUPS_CREATE: "backups.create",
  BACKUPS_DELETE: "backups.delete",
  BACKUPS_RESTORE: "backups.restore",
  BACKUPS_DOWNLOAD: "backups.download",

  // Allocations permissions
  ALLOCATIONS_READ: "allocations.read",
  ALLOCATIONS_CREATE: "allocations.create",
  ALLOCATIONS_DELETE: "allocations.delete",
  ALLOCATIONS_UPDATE: "allocations.update",

  // Startup permissions
  STARTUP_READ: "startup.read",
  STARTUP_UPDATE: "startup.update",
  STARTUP_DOCKER_IMAGE: "startup.docker-image",

  // Settings permissions
  SETTINGS_READ: "settings.read",
  SETTINGS_RENAME: "settings.rename",
  SETTINGS_DESCRIPTION: "settings.description",
  SETTINGS_REINSTALL: "settings.reinstall",

  // Activity permissions
  ACTIVITY_READ: "activity.read",

  // Schedules permissions
  SCHEDULES_READ: "schedules.read",
  SCHEDULES_CREATE: "schedules.create",
  SCHEDULES_UPDATE: "schedules.update",
  SCHEDULES_DELETE: "schedules.delete",

  // Users/subuser permissions
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",

  // Database permissions (for future use)
  DATABASE_READ: "database.read",
  DATABASE_CREATE: "database.create",
  DATABASE_DELETE: "database.delete",
  DATABASE_VIEW_PASSWORD: "database.view-password",

  // Server splitting permissions
  SPLIT_READ: "split.read",
  SPLIT_CREATE: "split.create",
  SPLIT_DELETE: "split.delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[keyof typeof PERMISSION_CATEGORIES];

// Helper functions
export const hasPermission = (userPermissions: string[], permission: Permission): boolean => {
  // Wildcard grants all permissions
  if (userPermissions.includes("*")) {
    return true;
  }

  // Direct permission match
  if (userPermissions.includes(permission)) {
    return true;
  }

  // Category wildcard (e.g., "control.*" grants all control permissions)
  const category = permission.split(".")[0];
  if (userPermissions.includes(`${category}.*`)) {
    return true;
  }

  return false;
};

export const hasAnyPermission = (userPermissions: string[], permissions: Permission[]): boolean => {
  return permissions.some((p) => hasPermission(userPermissions, p));
};

export const hasAllPermissions = (
  userPermissions: string[],
  permissions: Permission[]
): boolean => {
  return permissions.every((p) => hasPermission(userPermissions, p));
};

// Preset permission sets
export const PERMISSION_PRESETS = {
  VIEWER: [
    PERMISSIONS.CONSOLE_READ,
    PERMISSIONS.FILES_READ,
    PERMISSIONS.BACKUPS_READ,
    PERMISSIONS.ALLOCATIONS_READ,
    PERMISSIONS.STARTUP_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.SCHEDULES_READ,
    PERMISSIONS.USERS_READ,
  ],
  OPERATOR: [
    PERMISSIONS.CONTROL_START,
    PERMISSIONS.CONTROL_STOP,
    PERMISSIONS.CONTROL_RESTART,
    PERMISSIONS.CONSOLE_READ,
    PERMISSIONS.CONSOLE_WRITE,
    PERMISSIONS.FILES_READ,
    PERMISSIONS.FILES_WRITE,
    PERMISSIONS.FILES_CREATE,
    PERMISSIONS.BACKUPS_READ,
    PERMISSIONS.BACKUPS_CREATE,
    PERMISSIONS.ALLOCATIONS_READ,
    PERMISSIONS.STARTUP_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.SCHEDULES_READ,
    PERMISSIONS.SCHEDULES_CREATE,
  ],
  ADMIN: ["*"] as string[], // Full access
};
