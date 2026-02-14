/**
 * StellarStack Permission Nodes
 *
 * Permission nodes are hierarchical and follow the pattern: category.action
 * The wildcard "*" grants all permissions in a category
 * Full admin access is represented by ["*"]
 */

import type { Permission, PermissionCategory, PermissionDefinition } from "./PermissionsTypes";

// Re-export types for backwards compatibility
export type { Permission, PermissionCategory, PermissionDefinition } from "./PermissionsTypes";

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

// Permission definitions with metadata for UI
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Control
  {
    key: PERMISSIONS.CONTROL_START,
    name: "Start Server",
    description: "Ability to start the server",
    category: PERMISSION_CATEGORIES.CONTROL,
  },
  {
    key: PERMISSIONS.CONTROL_STOP,
    name: "Stop Server",
    description: "Ability to stop the server gracefully",
    category: PERMISSION_CATEGORIES.CONTROL,
  },
  {
    key: PERMISSIONS.CONTROL_RESTART,
    name: "Restart Server",
    description: "Ability to restart the server",
    category: PERMISSION_CATEGORIES.CONTROL,
  },
  {
    key: PERMISSIONS.CONTROL_KILL,
    name: "Kill Server",
    description: "Ability to forcefully kill the server process",
    category: PERMISSION_CATEGORIES.CONTROL,
  },

  // Console
  {
    key: PERMISSIONS.CONSOLE_READ,
    name: "Read Console",
    description: "View server console output",
    category: PERMISSION_CATEGORIES.CONSOLE,
  },
  {
    key: PERMISSIONS.CONSOLE_WRITE,
    name: "Send Commands",
    description: "Send commands to the server console",
    category: PERMISSION_CATEGORIES.CONSOLE,
  },

  // Files
  {
    key: PERMISSIONS.FILES_READ,
    name: "Read Files",
    description: "View and download files",
    category: PERMISSION_CATEGORIES.FILES,
  },
  {
    key: PERMISSIONS.FILES_WRITE,
    name: "Edit Files",
    description: "Edit existing files",
    category: PERMISSION_CATEGORIES.FILES,
  },
  {
    key: PERMISSIONS.FILES_CREATE,
    name: "Create Files",
    description: "Create new files and folders",
    category: PERMISSION_CATEGORIES.FILES,
  },
  {
    key: PERMISSIONS.FILES_DELETE,
    name: "Delete Files",
    description: "Delete files and folders",
    category: PERMISSION_CATEGORIES.FILES,
  },
  {
    key: PERMISSIONS.FILES_ARCHIVE,
    name: "Archive Files",
    description: "Create and extract archives",
    category: PERMISSION_CATEGORIES.FILES,
  },
  {
    key: PERMISSIONS.FILES_SFTP,
    name: "SFTP Access",
    description: "Connect via SFTP",
    category: PERMISSION_CATEGORIES.FILES,
  },

  // Backups
  {
    key: PERMISSIONS.BACKUPS_READ,
    name: "View Backups",
    description: "View list of backups",
    category: PERMISSION_CATEGORIES.BACKUPS,
  },
  {
    key: PERMISSIONS.BACKUPS_CREATE,
    name: "Create Backups",
    description: "Create new backups",
    category: PERMISSION_CATEGORIES.BACKUPS,
  },
  {
    key: PERMISSIONS.BACKUPS_DELETE,
    name: "Delete Backups",
    description: "Delete existing backups",
    category: PERMISSION_CATEGORIES.BACKUPS,
  },
  {
    key: PERMISSIONS.BACKUPS_RESTORE,
    name: "Restore Backups",
    description: "Restore server from a backup",
    category: PERMISSION_CATEGORIES.BACKUPS,
  },
  {
    key: PERMISSIONS.BACKUPS_DOWNLOAD,
    name: "Download Backups",
    description: "Download backup files",
    category: PERMISSION_CATEGORIES.BACKUPS,
  },

  // Allocations
  {
    key: PERMISSIONS.ALLOCATIONS_READ,
    name: "View Allocations",
    description: "View server allocations",
    category: PERMISSION_CATEGORIES.ALLOCATIONS,
  },
  {
    key: PERMISSIONS.ALLOCATIONS_CREATE,
    name: "Add Allocations",
    description: "Add new allocations to server",
    category: PERMISSION_CATEGORIES.ALLOCATIONS,
  },
  {
    key: PERMISSIONS.ALLOCATIONS_DELETE,
    name: "Remove Allocations",
    description: "Remove allocations from server",
    category: PERMISSION_CATEGORIES.ALLOCATIONS,
  },
  {
    key: PERMISSIONS.ALLOCATIONS_UPDATE,
    name: "Update Allocations",
    description: "Set primary allocation",
    category: PERMISSION_CATEGORIES.ALLOCATIONS,
  },

  // Startup
  {
    key: PERMISSIONS.STARTUP_READ,
    name: "View Startup",
    description: "View startup configuration",
    category: PERMISSION_CATEGORIES.STARTUP,
  },
  {
    key: PERMISSIONS.STARTUP_UPDATE,
    name: "Edit Startup",
    description: "Edit startup variables",
    category: PERMISSION_CATEGORIES.STARTUP,
  },
  {
    key: PERMISSIONS.STARTUP_DOCKER_IMAGE,
    name: "Change Docker Image",
    description: "Change the server's Docker image",
    category: PERMISSION_CATEGORIES.STARTUP,
  },

  // Settings
  {
    key: PERMISSIONS.SETTINGS_READ,
    name: "View Settings",
    description: "View server settings",
    category: PERMISSION_CATEGORIES.SETTINGS,
  },
  {
    key: PERMISSIONS.SETTINGS_RENAME,
    name: "Rename Server",
    description: "Change the server name",
    category: PERMISSION_CATEGORIES.SETTINGS,
  },
  {
    key: PERMISSIONS.SETTINGS_DESCRIPTION,
    name: "Edit Description",
    description: "Change the server description",
    category: PERMISSION_CATEGORIES.SETTINGS,
  },
  {
    key: PERMISSIONS.SETTINGS_REINSTALL,
    name: "Reinstall Server",
    description: "Reinstall the server (destructive)",
    category: PERMISSION_CATEGORIES.SETTINGS,
  },

  // Activity
  {
    key: PERMISSIONS.ACTIVITY_READ,
    name: "View Activity",
    description: "View server activity logs",
    category: PERMISSION_CATEGORIES.ACTIVITY,
  },

  // Schedules
  {
    key: PERMISSIONS.SCHEDULES_READ,
    name: "View Schedules",
    description: "View scheduled tasks",
    category: PERMISSION_CATEGORIES.SCHEDULES,
  },
  {
    key: PERMISSIONS.SCHEDULES_CREATE,
    name: "Create Schedules",
    description: "Create new scheduled tasks",
    category: PERMISSION_CATEGORIES.SCHEDULES,
  },
  {
    key: PERMISSIONS.SCHEDULES_UPDATE,
    name: "Edit Schedules",
    description: "Edit existing scheduled tasks",
    category: PERMISSION_CATEGORIES.SCHEDULES,
  },
  {
    key: PERMISSIONS.SCHEDULES_DELETE,
    name: "Delete Schedules",
    description: "Delete scheduled tasks",
    category: PERMISSION_CATEGORIES.SCHEDULES,
  },

  // Users
  {
    key: PERMISSIONS.USERS_READ,
    name: "View Subusers",
    description: "View server subusers",
    category: PERMISSION_CATEGORIES.USERS,
  },
  {
    key: PERMISSIONS.USERS_CREATE,
    name: "Invite Subusers",
    description: "Invite new subusers",
    category: PERMISSION_CATEGORIES.USERS,
  },
  {
    key: PERMISSIONS.USERS_UPDATE,
    name: "Edit Subusers",
    description: "Edit subuser permissions",
    category: PERMISSION_CATEGORIES.USERS,
  },
  {
    key: PERMISSIONS.USERS_DELETE,
    name: "Remove Subusers",
    description: "Remove subusers from server",
    category: PERMISSION_CATEGORIES.USERS,
  },

  // Database
  {
    key: PERMISSIONS.DATABASE_READ,
    name: "View Databases",
    description: "View database list",
    category: PERMISSION_CATEGORIES.DATABASE,
  },
  {
    key: PERMISSIONS.DATABASE_CREATE,
    name: "Create Databases",
    description: "Create new databases",
    category: PERMISSION_CATEGORIES.DATABASE,
  },
  {
    key: PERMISSIONS.DATABASE_DELETE,
    name: "Delete Databases",
    description: "Delete databases",
    category: PERMISSION_CATEGORIES.DATABASE,
  },
  {
    key: PERMISSIONS.DATABASE_VIEW_PASSWORD,
    name: "View Database Password",
    description: "View database passwords",
    category: PERMISSION_CATEGORIES.DATABASE,
  },

  // Split
  {
    key: PERMISSIONS.SPLIT_READ,
    name: "View Split Servers",
    description: "View child servers from splitting",
    category: PERMISSION_CATEGORIES.SPLIT,
  },
  {
    key: PERMISSIONS.SPLIT_CREATE,
    name: "Split Server",
    description: "Create child servers by splitting resources",
    category: PERMISSION_CATEGORIES.SPLIT,
  },
  {
    key: PERMISSIONS.SPLIT_DELETE,
    name: "Delete Split Servers",
    description: "Delete child servers",
    category: PERMISSION_CATEGORIES.SPLIT,
  },
];

// Category metadata for UI
export const CATEGORY_DEFINITIONS = {
  [PERMISSION_CATEGORIES.CONTROL]: {
    name: "Power Controls",
    description: "Server power management",
    icon: "power",
  },
  [PERMISSION_CATEGORIES.CONSOLE]: {
    name: "Console",
    description: "Server console access",
    icon: "terminal",
  },
  [PERMISSION_CATEGORIES.FILES]: {
    name: "File Manager",
    description: "File management access",
    icon: "folder",
  },
  [PERMISSION_CATEGORIES.BACKUPS]: {
    name: "Backups",
    description: "Backup management",
    icon: "archive",
  },
  [PERMISSION_CATEGORIES.ALLOCATIONS]: {
    name: "Network",
    description: "Network allocation management",
    icon: "network",
  },
  [PERMISSION_CATEGORIES.STARTUP]: {
    name: "Startup",
    description: "Startup configuration",
    icon: "play",
  },
  [PERMISSION_CATEGORIES.SETTINGS]: {
    name: "Settings",
    description: "Server settings",
    icon: "settings",
  },
  [PERMISSION_CATEGORIES.ACTIVITY]: {
    name: "Activity",
    description: "Activity logs",
    icon: "activity",
  },
  [PERMISSION_CATEGORIES.SCHEDULES]: {
    name: "Schedules",
    description: "Task scheduling",
    icon: "clock",
  },
  [PERMISSION_CATEGORIES.USERS]: {
    name: "Subusers",
    description: "Subuser management",
    icon: "users",
  },
  [PERMISSION_CATEGORIES.DATABASE]: {
    name: "Databases",
    description: "Database management",
    icon: "database",
  },
  [PERMISSION_CATEGORIES.SPLIT]: {
    name: "Server Splitting",
    description: "Resource splitting",
    icon: "split",
  },
};

// Helper functions
export const HasPermission = (userPermissions: string[], permission: Permission): boolean => {
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

export const HasAnyPermission = (userPermissions: string[], permissions: Permission[]): boolean => {
  return permissions.some((p) => HasPermission(userPermissions, p));
};

export const HasAllPermissions = (userPermissions: string[], permissions: Permission[]): boolean => {
  return permissions.every((p) => HasPermission(userPermissions, p));
};

export const GetPermissionsByCategory = (category: PermissionCategory): PermissionDefinition[] => {
  return PERMISSION_DEFINITIONS.filter((p) => p.category === category);
};

export const GetAllCategories = (): PermissionCategory[] => {
  return Object.values(PERMISSION_CATEGORIES);
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
  ADMIN: ["*"], // Full access
};
