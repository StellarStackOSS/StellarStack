/**
 * StellarStack Plugin SDK - Type Definitions
 *
 * This file defines the core types used throughout the plugin system.
 * Plugin authors should import these types when building plugins.
 */

import { z } from "zod";

// ============================================
// Plugin Manifest
// ============================================

/**
 * The plugin manifest schema (stellar-plugin.json).
 * Every plugin must provide a manifest that describes its capabilities.
 */
export const PluginManifestSchema = z.object({
  /** Unique plugin identifier (lowercase, alphanumeric, hyphens) */
  id: z.string().regex(/^[a-z0-9-]+$/, "Plugin ID must be lowercase alphanumeric with hyphens"),

  /** Human-readable plugin name */
  name: z.string().min(1).max(64),

  /** Plugin version (semver) */
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Version must follow semver"),

  /** Short description of the plugin */
  description: z.string().max(256),

  /** Plugin author */
  author: z.string(),

  /** Plugin license */
  license: z.string().default("MIT"),

  /** Plugin homepage URL */
  homepage: z.string().url().optional(),

  /** Plugin repository URL */
  repository: z.string().url().optional(),

  /** Plugin icon (relative path or URL) */
  icon: z.string().optional(),

  /** Minimum StellarStack version required */
  minVersion: z.string().optional(),

  /** Plugin category for the marketplace */
  category: z
    .enum([
      "game-management",
      "modding",
      "monitoring",
      "automation",
      "integration",
      "security",
      "utility",
      "theme",
      "other",
    ])
    .default("other"),

  /**
   * Game types this plugin supports.
   * Use "*" for all games, or specific identifiers like "minecraft", "rust", "valheim".
   * Game types are matched against the blueprint category.
   */
  gameTypes: z.array(z.string()).default(["*"]),

  /** Required StellarStack permissions for this plugin */
  permissions: z.array(z.string()).default([]),

  /** UI extension points this plugin provides */
  ui: z
    .object({
      /** Tabs to add to the server management page */
      serverTabs: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            icon: z.string(),
            /** Path to the React component (relative to plugin root) */
            component: z.string(),
          })
        )
        .optional(),

      /** Pages to add to the admin panel */
      adminPages: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            icon: z.string(),
            component: z.string(),
          })
        )
        .optional(),

      /** Widgets to add to the server overview dashboard */
      serverWidgets: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            component: z.string(),
            /** Grid size: small (1x1), medium (2x1), large (2x2) */
            size: z.enum(["small", "medium", "large"]).default("medium"),
          })
        )
        .optional(),

      /** Plugin settings panel component */
      settingsPanel: z.string().optional(),
    })
    .optional(),

  /** Configuration schema for plugin settings (JSON Schema format) */
  configSchema: z.record(z.any()).optional(),

  /** Default configuration values */
  defaultConfig: z.record(z.any()).optional(),

  /** Plugin hooks this plugin subscribes to */
  hooks: z.array(z.string()).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ============================================
// Plugin Status & State
// ============================================

export type PluginStatus = "installed" | "enabled" | "disabled" | "error" | "updating";

export interface PluginState {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Current status */
  status: PluginStatus;
  /** Whether this is a built-in (official) plugin */
  isBuiltIn: boolean;
  /** When the plugin was installed */
  installedAt: string;
  /** When the plugin was last updated */
  updatedAt: string;
  /** Error message if status is 'error' */
  error?: string;
  /** Plugin configuration (merged defaults + user overrides) */
  config: Record<string, unknown>;
}

// ============================================
// Hook System Types
// ============================================

/** All available plugin hook events */
export type PluginHookEvent =
  // Server lifecycle
  | "server:beforeStart"
  | "server:afterStart"
  | "server:beforeStop"
  | "server:afterStop"
  | "server:beforeRestart"
  | "server:afterRestart"
  | "server:beforeInstall"
  | "server:afterInstall"
  | "server:statusChange"
  | "server:created"
  | "server:deleted"
  // Console
  | "server:console"
  // File operations
  | "server:file:beforeWrite"
  | "server:file:afterWrite"
  | "server:file:beforeDelete"
  | "server:file:afterDelete"
  // Backups
  | "server:backup:beforeCreate"
  | "server:backup:afterCreate"
  | "server:backup:beforeRestore"
  | "server:backup:afterRestore"
  // Schedules
  | "server:schedule:beforeExecute"
  | "server:schedule:afterExecute"
  // User actions
  | "user:login"
  | "user:created"
  // Plugin lifecycle
  | "plugin:enabled"
  | "plugin:disabled"
  | "plugin:configUpdated";

/** Data passed to hook handlers */
export interface HookContext {
  /** The event that triggered this hook */
  event: PluginHookEvent;
  /** Server ID (if applicable) */
  serverId?: string;
  /** User ID (if applicable) */
  userId?: string;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** Timestamp of the event */
  timestamp: Date;
}

/** Hook handler function signature */
export type HookHandler = (context: HookContext) => Promise<void> | void;

/** Hook filter function that can transform data */
export type HookFilter<T = unknown> = (value: T, context: HookContext) => Promise<T> | T;

// ============================================
// Plugin Route Types
// ============================================

/** HTTP method for plugin routes */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Plugin route definition */
export interface PluginRoute {
  /** HTTP method */
  method: HttpMethod;
  /** Path relative to /api/plugins/:pluginId/ */
  path: string;
  /** Route handler */
  handler: PluginRouteHandler;
  /** Route description (for documentation) */
  description?: string;
  /** Whether this route requires authentication */
  requireAuth?: boolean;
  /** Whether this route requires admin access */
  requireAdmin?: boolean;
}

/** Plugin route handler context */
export interface PluginRouteContext {
  /** Request body (parsed JSON) */
  body: unknown;
  /** URL query parameters */
  query: Record<string, string>;
  /** URL path parameters */
  params: Record<string, string>;
  /** Authenticated user (if requireAuth is true) */
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  /** Plugin configuration */
  config: Record<string, unknown>;
}

/** Plugin route handler function */
export type PluginRouteHandler = (
  ctx: PluginRouteContext
) => Promise<PluginRouteResponse> | PluginRouteResponse;

/** Plugin route response */
export interface PluginRouteResponse {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

// ============================================
// Plugin API Context Types
// ============================================

/**
 * The PluginAPI is the interface plugins use to interact with StellarStack.
 * It provides safe, scoped access to servers, files, and other resources.
 */
export interface PluginAPI {
  /** Server operations */
  servers: {
    /** Get server by ID */
    get(serverId: string): Promise<ServerInfo>;
    /** List servers (admin only in hooks) */
    list(): Promise<ServerInfo[]>;
    /** Send a command to a server's console */
    sendCommand(serverId: string, command: string): Promise<void>;
    /** Get server status */
    getStatus(serverId: string): Promise<string>;
  };

  /** File operations (scoped to server) */
  files: {
    /** List files in a directory */
    list(serverId: string, path?: string): Promise<FileInfo[]>;
    /** Read a file's contents */
    read(serverId: string, path: string): Promise<string>;
    /** Write content to a file */
    write(serverId: string, path: string, content: string): Promise<void>;
    /** Create a file or directory */
    create(
      serverId: string,
      path: string,
      type: "file" | "directory",
      content?: string
    ): Promise<void>;
    /** Delete a file or directory */
    delete(serverId: string, path: string): Promise<void>;
    /** Download a file from a URL to the server */
    downloadUrl(serverId: string, url: string, destPath: string): Promise<void>;
  };

  /** Plugin storage (key-value store scoped to this plugin) */
  storage: {
    /** Get a value from plugin storage */
    get<T = unknown>(key: string): Promise<T | null>;
    /** Set a value in plugin storage */
    set<T = unknown>(key: string, value: T): Promise<void>;
    /** Delete a value from plugin storage */
    delete(key: string): Promise<void>;
    /** List all keys in plugin storage */
    keys(): Promise<string[]>;
  };

  /** HTTP client for external API calls */
  http: {
    /** Make a GET request */
    get<T = unknown>(url: string, headers?: Record<string, string>): Promise<T>;
    /** Make a POST request */
    post<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
    /** Make a PUT request */
    put<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
    /** Make a DELETE request */
    delete<T = unknown>(url: string, headers?: Record<string, string>): Promise<T>;
  };

  /** Logging */
  log: {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
  };

  /** Notifications */
  notify: {
    /** Send a toast notification to connected clients */
    toast(serverId: string, message: string, type?: "success" | "error" | "warning" | "info"): void;
  };
}

// ============================================
// Server & File Info Types
// ============================================

export interface ServerInfo {
  id: string;
  name: string;
  description?: string;
  status: string;
  memory: number;
  disk: number;
  cpu: number;
  nodeId: string;
  blueprintId: string;
  ownerId: string;
  blueprint?: {
    id: string;
    name: string;
    category?: string;
  };
}

export interface FileInfo {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string;
}

// ============================================
// UI Component Props Types
// ============================================

/** Props passed to server tab components */
export interface ServerTabProps {
  /** Server ID */
  serverId: string;
  /** Server data */
  server: ServerInfo;
  /** Plugin configuration */
  pluginConfig: Record<string, unknown>;
}

/** Props passed to server widget components */
export interface ServerWidgetProps {
  /** Server ID */
  serverId: string;
  /** Server data */
  server: ServerInfo;
  /** Plugin configuration */
  pluginConfig: Record<string, unknown>;
}

/** Props passed to admin page components */
export interface AdminPageProps {
  /** Plugin configuration */
  pluginConfig: Record<string, unknown>;
}

/** Props passed to settings panel components */
export interface SettingsPanelProps {
  /** Current plugin configuration */
  config: Record<string, unknown>;
  /** Callback to update configuration */
  onConfigChange: (config: Record<string, unknown>) => void;
}
