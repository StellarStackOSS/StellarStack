/**
 * StellarStack Plugin Manager
 *
 * Manages the lifecycle of all plugins: loading, enabling, disabling,
 * configuration, and hook dispatch. This is the central orchestrator
 * for the plugin system.
 */

import { db } from "./db";
import type { Plugin as PluginRecord } from "@prisma/client";
import { pluginWorkerPool } from "./plugin-worker";

// ============================================
// Types (inline to avoid cross-package dependency issues at build time)
// ============================================

export type PluginHookEvent =
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
  | "server:console"
  | "server:file:beforeWrite"
  | "server:file:afterWrite"
  | "server:file:beforeDelete"
  | "server:file:afterDelete"
  | "server:backup:beforeCreate"
  | "server:backup:afterCreate"
  | "server:backup:beforeRestore"
  | "server:backup:afterRestore"
  | "server:schedule:beforeExecute"
  | "server:schedule:afterExecute"
  | "user:login"
  | "user:created"
  | "plugin:enabled"
  | "plugin:disabled"
  | "plugin:configUpdated";

export interface HookContext {
  event: PluginHookEvent;
  serverId?: string;
  userId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

type HookHandler = (context: HookContext) => Promise<void> | void;

interface RegisteredHook {
  pluginId: string;
  handler: HookHandler;
  priority: number;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  minVersion?: string;
  category?: string;
  gameTypes?: string[];
  permissions?: string[];
  hooks?: string[];
  actions?: Array<{
    id: string;
    label: string;
    description?: string;
    icon?: string;
    dangerous?: boolean;
    params?: Array<{
      id: string;
      label: string;
      type: "string" | "number" | "boolean" | "select";
      description?: string;
      required?: boolean;
      default?: unknown;
      options?: Array<{ label: string; value: unknown }>;
    }>;
    operations: Array<{
      type: "download-to-server" | "write-file" | "delete-file" | "delete-all-files" | "send-command" | "restart-server" | "stop-server" | "start-server" | "create-backup";
      [key: string]: unknown;
    }>;
  }>;
  ui?: {
    serverTabs?: Array<{
      id: string;
      label: string;
      icon: string;
      component?: string;
      uiSchema?: unknown; // UISchema type from SDK
    }>;
    adminPages?: Array<{
      id: string;
      label: string;
      icon: string;
      component: string;
    }>;
    serverWidgets?: Array<{
      id: string;
      label: string;
      component: string;
      size?: string;
    }>;
    settingsPanel?: string;
  };
  configSchema?: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
}

export interface PluginInfo {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  license: string;
  category: string;
  icon: string | null;
  homepage: string | null;
  repository: string | null;
  status: string;
  isBuiltIn: boolean;
  error: string | null;
  gameTypes: string[];
  permissions: string[];
  config: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  configSchema: Record<string, unknown> | null;
  uiMetadata: Record<string, unknown> | null;
  manifest: PluginManifest;
  installedAt: string;
  enabledAt: string | null;
  updatedAt: string;
}

// ============================================
// Hook Registry
// ============================================

class HookRegistry {
  private hooks: Map<PluginHookEvent, RegisteredHook[]> = new Map();

  on(event: PluginHookEvent, pluginId: string, handler: HookHandler, priority = 10): void {
    const existing = this.hooks.get(event) || [];
    existing.push({ pluginId, handler, priority });
    existing.sort((a, b) => a.priority - b.priority);
    this.hooks.set(event, existing);
  }

  removePlugin(pluginId: string): void {
    for (const [event, handlers] of this.hooks.entries()) {
      this.hooks.set(
        event,
        handlers.filter((h) => h.pluginId !== pluginId)
      );
    }
  }

  async emit(
    event: PluginHookEvent,
    context: Omit<HookContext, "event" | "timestamp">
  ): Promise<void> {
    const handlers = this.hooks.get(event);
    if (!handlers || handlers.length === 0) return;

    const fullContext: HookContext = {
      ...context,
      event,
      timestamp: new Date(),
    };

    for (const { pluginId, handler } of handlers) {
      try {
        await handler(fullContext);
      } catch (error) {
        console.error(`[Plugin:${pluginId}] Hook error on ${event}:`, error);
      }
    }
  }

  getRegisteredHooks(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [event, handlers] of this.hooks.entries()) {
      result[event] = handlers.map((h) => h.pluginId);
    }
    return result;
  }
}

// ============================================
// Built-in Plugin Registry
// ============================================

/**
 * Built-in plugins are defined here and automatically registered.
 * They provide official functionality that ships with StellarStack.
 */
const BUILT_IN_PLUGINS: PluginManifest[] = [
  {
    id: "curseforge-installer",
    name: "CurseForge Modpack Installer",
    version: "1.0.0",
    description:
      "Browse and install CurseForge modpacks directly from the panel. Supports automatic server configuration and one-click installs.",
    author: "StellarStack",
    license: "MIT",
    icon: "flame",
    category: "modding",
    gameTypes: ["minecraft"],
    permissions: ["files.*", "control.start", "control.stop"],
    ui: {
      serverTabs: [
        {
          id: "modpacks",
          label: "Modpacks",
          icon: "flame",
          uiSchema: {
            type: "search-and-install",
            searchAction: "search-modpacks",
            detailAction: "get-modpack-details",
            installAction: "install-modpack",
            fields: {
              searchInput: {
                label: "Search Modpacks",
                placeholder: "Search by name or author...",
              },
              resultCard: {
                title: "name",
                subtitle: "authors",
                image: "logo",
                description: "summary",
                metadata: [
                  {
                    label: "Downloads",
                    field: "downloadCount",
                    format: "number",
                  },
                  {
                    label: "Updated",
                    field: "dateModified",
                    format: "date",
                  },
                ],
              },
            },
          },
        },
      ],
    },
    actions: [
      {
        id: "install-modpack",
        label: "Install Modpack",
        description: "Download and install a CurseForge modpack",
        dangerous: true,
        params: [
          {
            id: "modId",
            label: "Mod ID",
            type: "number",
            required: true,
          },
          {
            id: "fileId",
            label: "File ID",
            type: "number",
            required: true,
          },
          {
            id: "cleanupExisting",
            label: "Clean Existing Files",
            type: "boolean",
            required: false,
            default: false,
            description: "Delete all existing server files before installing the modpack",
          },
        ],
        operations: [
          {
            type: "delete-all-files",
            // Only executed if cleanupExisting is true
            // This is a placeholder - actual conditional logic handled by frontend
          },
          {
            type: "download-to-server",
            url: "https://api.curseforge.com/v1/mods/{{modId}}/files/{{fileId}}/download",
            dest_path: "modpack.zip",
            decompress: true,
            directory: ".",
            headers: {
              "x-api-key": "{{config.apiKey}}",
            },
          },
          {
            type: "restart-server",
          },
        ],
      },
      {
        id: "search-modpacks",
        label: "Search Modpacks",
        description: "Search for available CurseForge modpacks",
        operations: [],
      },
      {
        id: "get-modpack-details",
        label: "Get Modpack Details",
        description: "Fetch detailed information about a modpack",
        operations: [],
      },
    ],
    configSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          title: "CurseForge API Key",
          description:
            "Your CurseForge API key for accessing the CurseForge API. Get one at https://console.curseforge.com/",
          sensitive: true, // SECURITY: Mark as sensitive to prevent exposure in API responses
        },
        autoRestart: {
          type: "boolean",
          title: "Auto-Restart After Install",
          description: "Automatically restart the server after installing a modpack",
          default: true,
        },
        backupBeforeInstall: {
          type: "boolean",
          title: "Backup Before Install",
          description: "Create a backup before installing a modpack",
          default: true,
        },
      },
      required: ["apiKey"],
    },
    defaultConfig: {
      apiKey: "",
      autoRestart: true,
      backupBeforeInstall: true,
    },
  },
  {
    id: "modrinth-installer",
    name: "Modrinth Mod Manager",
    version: "1.0.0",
    description:
      "Search and install mods, modpacks, and resource packs from Modrinth. The open-source mod hosting platform.",
    author: "StellarStack",
    license: "MIT",
    icon: "leaf",
    category: "modding",
    gameTypes: ["minecraft"],
    permissions: ["files.*", "control.start", "control.stop"],
    ui: {
      serverTabs: [
        {
          id: "modrinth",
          label: "Modrinth",
          icon: "leaf",
          uiSchema: {
            type: "search-and-install",
            searchAction: "search-projects",
            detailAction: "get-project-details",
            installAction: "install-project",
            fields: {
              searchInput: {
                label: "Search Modrinth",
                placeholder: "Search mods, modpacks, or resource packs...",
              },
              resultCard: {
                title: "name",
                subtitle: "author",
                image: "icon_url",
                description: "description",
                metadata: [
                  {
                    label: "Downloads",
                    field: "downloads",
                    format: "number",
                  },
                  {
                    label: "Updated",
                    field: "date_modified",
                    format: "date",
                  },
                ],
              },
            },
          },
        },
      ],
    },
    defaultConfig: {},
  },
  {
    id: "steam-workshop",
    name: "Steam Workshop Manager",
    version: "1.0.0",
    description:
      "Browse and manage Steam Workshop items for supported games. Automatically downloads and configures workshop content.",
    author: "StellarStack",
    license: "MIT",
    icon: "gamepad",
    category: "modding",
    gameTypes: ["rust", "garry-s-mod", "valheim", "ark"],
    permissions: ["files.*", "control.start", "control.stop"],
    ui: {
      serverTabs: [
        {
          id: "workshop",
          label: "Workshop",
          icon: "gamepad",
          component: "SteamWorkshopTab",
        },
      ],
    },
    defaultConfig: {},
  },
  {
    id: "server-announcer",
    name: "Server Announcer",
    version: "1.0.0",
    description:
      "Schedule and send automated announcements to your game server. Supports timed messages, restart warnings, and custom templates.",
    author: "StellarStack",
    license: "MIT",
    icon: "megaphone",
    category: "automation",
    gameTypes: ["*"],
    permissions: ["console.send"],
    ui: {
      serverTabs: [
        {
          id: "announcements",
          label: "Announcements",
          icon: "megaphone",
          component: "AnnouncerTab",
        },
      ],
    },
    configSchema: {
      type: "object",
      properties: {
        prefix: {
          type: "string",
          title: "Message Prefix",
          description: "Prefix added before all announcements",
          default: "[Server]",
        },
        commandFormat: {
          type: "string",
          title: "Command Format",
          description: "The console command to send messages. Use {message} as placeholder.",
          default: "say {message}",
        },
      },
    },
    defaultConfig: {
      prefix: "[Server]",
      commandFormat: "say {message}",
    },
  },
  {
    id: "player-analytics",
    name: "Player Analytics",
    version: "1.0.0",
    description:
      "Track player activity, peak hours, and session durations. Visualize player data with charts and export reports.",
    author: "StellarStack",
    license: "MIT",
    icon: "chart",
    category: "monitoring",
    gameTypes: ["*"],
    permissions: ["activity.read"],
    ui: {
      serverWidgets: [
        {
          id: "player-chart",
          label: "Player Activity",
          component: "PlayerChartWidget",
          size: "large",
        },
      ],
    },
    defaultConfig: {},
  },
];

// ============================================
// Plugin Manager
// ============================================

class PluginManager {
  private hookRegistry: HookRegistry = new HookRegistry();
  private initialized = false;
  private activeWorkers: Set<string> = new Set();

  /**
   * Initialize the plugin system.
   * Registers all built-in plugins and enables those that are marked as enabled.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[Plugins] Initializing plugin system...");

    // Ensure built-in plugins are registered in the database
    for (const manifest of BUILT_IN_PLUGINS) {
      await this.ensureBuiltInPlugin(manifest);
    }

    // Load and enable all enabled plugins
    const enabledPlugins = await db.plugin.findMany({
      where: { status: "enabled" },
    });

    for (const plugin of enabledPlugins) {
      try {
        await this.activatePlugin(plugin);
        // Start worker process for community plugins
        if (!plugin.isBuiltIn) {
          this.activeWorkers.add(plugin.pluginId);
        }
      } catch (error) {
        console.error(`[Plugins] Failed to activate plugin ${plugin.pluginId}:`, error);
        await db.plugin.update({
          where: { id: plugin.id },
          data: { status: "error", error: String(error) },
        });
      }
    }

    this.initialized = true;
    console.log(`[Plugins] Initialized ${enabledPlugins.length} plugin(s) with ${this.activeWorkers.size} worker process(es)`);
  }

  /**
   * Shutdown the plugin system gracefully.
   * Stops all worker processes and cleans up resources.
   */
  async shutdown(): Promise<void> {
    console.log("[Plugins] Shutting down plugin system...");

    // Stop all worker processes
    pluginWorkerPool.stopAll();
    this.activeWorkers.clear();

    console.log("[Plugins] Plugin system shutdown complete");
  }

  /**
   * Ensure a built-in plugin exists in the database.
   */
  private async ensureBuiltInPlugin(manifest: PluginManifest): Promise<void> {
    const existing = await db.plugin.findUnique({
      where: { pluginId: manifest.id },
    });

    const uiMetadata = manifest.ui
      ? {
          serverTabs: manifest.ui.serverTabs || [],
          adminPages: manifest.ui.adminPages || [],
          serverWidgets: manifest.ui.serverWidgets || [],
          hasSettingsPanel: !!manifest.ui.settingsPanel,
        }
      : null;

    if (!existing) {
      await db.plugin.create({
        data: {
          pluginId: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          license: manifest.license || "MIT",
          category: manifest.category || "other",
          icon: manifest.icon,
          homepage: manifest.homepage,
          repository: manifest.repository,
          status: "installed",
          isBuiltIn: true,
          gameTypes: manifest.gameTypes || ["*"],
          permissions: manifest.permissions || [],
          manifest: manifest as any,
          config: (manifest.defaultConfig || {}) as any,
          defaultConfig: (manifest.defaultConfig || {}) as any,
          configSchema: (manifest.configSchema || null) as any,
          uiMetadata: (uiMetadata || null) as any,
        },
      });
      console.log(`[Plugins] Registered built-in plugin: ${manifest.name}`);
    } else if (existing.version !== manifest.version) {
      // Update existing built-in plugin if version changed
      await db.plugin.update({
        where: { id: existing.id },
        data: {
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          license: manifest.license || "MIT",
          category: manifest.category || "other",
          icon: manifest.icon,
          homepage: manifest.homepage,
          repository: manifest.repository,
          gameTypes: manifest.gameTypes || ["*"],
          permissions: manifest.permissions || [],
          manifest: manifest as any,
          defaultConfig: (manifest.defaultConfig || {}) as any,
          configSchema: (manifest.configSchema || null) as any,
          uiMetadata: (uiMetadata || null) as any,
        },
      });
      console.log(`[Plugins] Updated built-in plugin: ${manifest.name} to v${manifest.version}`);
    }
  }

  /**
   * Activate a plugin (register its hooks).
   */
  private async activatePlugin(plugin: PluginRecord): Promise<void> {
    const manifest = plugin.manifest as unknown as PluginManifest;

    // For now, built-in plugins have their hooks registered here.
    // Community plugins would have their hooks loaded dynamically.
    if (manifest.hooks) {
      for (const hookName of manifest.hooks) {
        // Built-in hooks are registered through the route handlers
        console.log(`[Plugins] Plugin ${plugin.pluginId} subscribes to: ${hookName}`);
      }
    }

    console.log(`[Plugins] Activated plugin: ${plugin.pluginId}`);
  }

  /**
   * Get all plugins from the database.
   */
  async listPlugins(): Promise<PluginInfo[]> {
    const plugins = await db.plugin.findMany({
      orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    });
    return plugins.map((p) => this.serializePlugin(p));
  }

  /**
   * Get a specific plugin by its plugin ID.
   */
  async getPlugin(pluginId: string): Promise<PluginInfo | null> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });
    return plugin ? this.serializePlugin(plugin) : null;
  }

  /**
   * Enable a plugin.
   * Starts worker process for community plugins.
   */
  async enablePlugin(pluginId: string): Promise<PluginInfo> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    if (plugin.status === "enabled") throw new Error("Plugin is already enabled");

    const updated = await db.plugin.update({
      where: { id: plugin.id },
      data: {
        status: "enabled",
        enabledAt: new Date(),
        error: null,
      },
    });

    try {
      await this.activatePlugin(updated);

      // Start worker process for community plugins
      if (!updated.isBuiltIn && !this.activeWorkers.has(pluginId)) {
        try {
          const pluginPath = updated.gitRepoUrl || `/plugins/${pluginId}`;
          console.log(`[Plugins] Starting worker for community plugin ${pluginId}`);
          // Worker will be started on-demand during first action execution
          this.activeWorkers.add(pluginId);
        } catch (error) {
          console.error(`[Plugins] Failed to start worker for ${pluginId}:`, error);
          throw error;
        }
      }
    } catch (error) {
      await db.plugin.update({
        where: { id: plugin.id },
        data: { status: "error", error: String(error) },
      });
      throw error;
    }

    // Emit plugin enabled hook
    await this.hookRegistry.emit("plugin:enabled", {
      data: { pluginId },
    });

    console.log(`[Plugins] Enabled: ${pluginId}`);
    return this.serializePlugin(updated);
  }

  /**
   * Disable a plugin.
   * Stops worker process if it's a community plugin.
   */
  async disablePlugin(pluginId: string): Promise<PluginInfo> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    if (plugin.status === "disabled") throw new Error("Plugin is already disabled");

    // Remove hooks
    this.hookRegistry.removePlugin(pluginId);

    // Stop worker process for community plugins
    if (!plugin.isBuiltIn && this.activeWorkers.has(pluginId)) {
      console.log(`[Plugins] Stopping worker for ${pluginId}`);
      pluginWorkerPool.stopWorker(pluginId);
      this.activeWorkers.delete(pluginId);
    }

    const updated = await db.plugin.update({
      where: { id: plugin.id },
      data: {
        status: "disabled",
        error: null,
      },
    });

    // Emit plugin disabled hook
    await this.hookRegistry.emit("plugin:disabled", {
      data: { pluginId },
    });

    console.log(`[Plugins] Disabled: ${pluginId}`);
    return this.serializePlugin(updated);
  }

  /**
   * Update plugin configuration.
   */
  async updatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<PluginInfo> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

    // Merge with defaults
    const defaultConfig = (plugin.defaultConfig as Record<string, unknown>) || {};
    const mergedConfig = { ...defaultConfig, ...config };

    const updated = await db.plugin.update({
      where: { id: plugin.id },
      data: { config: mergedConfig as any },
    });

    // Emit config updated hook
    await this.hookRegistry.emit("plugin:configUpdated", {
      data: {
        pluginId,
        oldConfig: plugin.config,
        newConfig: mergedConfig,
      },
    });

    console.log(`[Plugins] Config updated: ${pluginId}`);
    return this.serializePlugin(updated);
  }

  /**
   * Uninstall a plugin (non-built-in only).
   * Stops worker process before deleting plugin record.
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    if (plugin.isBuiltIn) throw new Error("Cannot uninstall built-in plugins");

    // Remove hooks
    this.hookRegistry.removePlugin(pluginId);

    // Stop worker process
    if (this.activeWorkers.has(pluginId)) {
      console.log(`[Plugins] Stopping worker for ${pluginId}`);
      pluginWorkerPool.stopWorker(pluginId);
      this.activeWorkers.delete(pluginId);
    }

    // Delete plugin storage
    await db.pluginStorage.deleteMany({
      where: { pluginId: plugin.id },
    });

    // Delete plugin
    await db.plugin.delete({
      where: { id: plugin.id },
    });

    console.log(`[Plugins] Uninstalled: ${pluginId}`);
  }

  /**
   * Get plugins that provide server tabs for a specific server.
   * Matches plugin gameTypes against the blueprint name and category.
   *
   * Game type matching checks if any of the plugin's gameTypes appear in
   * the blueprint name or category (case-insensitive). For example:
   *   - Plugin gameTypes: ["minecraft"] matches blueprint name "Paper" -> no
   *   - Plugin gameTypes: ["minecraft"] matches blueprint name "Minecraft Vanilla" -> yes
   *   - Plugin gameTypes: ["*"] matches everything
   *
   * Common blueprint names: "Paper", "Minecraft Vanilla", "Forge", "Fabric",
   * "Rust", "Valheim", "ARK: Survival Evolved", etc.
   *
   * To improve matching, we also check known aliases.
   */
  async getServerTabPlugins(
    blueprintName?: string,
    blueprintCategory?: string
  ): Promise<PluginInfo[]> {
    const plugins = await db.plugin.findMany({
      where: {
        status: "enabled",
      },
    });

    // Known blueprint name -> game type aliases
    // This allows plugins with gameTypes: ["minecraft"] to match blueprints
    // named "Paper", "Forge", "Fabric", "Spigot", "Bukkit", "Purpur", etc.
    const GAME_ALIASES: Record<string, string[]> = {
      minecraft: [
        "minecraft",
        "paper",
        "spigot",
        "bukkit",
        "purpur",
        "forge",
        "fabric",
        "neoforge",
        "quilt",
        "sponge",
        "velocity",
        "waterfall",
        "bungeecord",
        "vanilla",
      ],
      rust: ["rust"],
      "garry-s-mod": ["garry", "gmod", "garrysmod"],
      valheim: ["valheim"],
      ark: ["ark", "survival evolved"],
    };

    const nameLC = blueprintName?.toLowerCase() || "";
    const categoryLC = blueprintCategory?.toLowerCase() || "";

    return plugins
      .filter((p) => {
        const uiMeta = p.uiMetadata as { serverTabs?: unknown[] } | null;
        if (!uiMeta?.serverTabs?.length) return false;

        // Check game type compatibility
        const gameTypes = p.gameTypes;
        if (gameTypes.includes("*")) return true;

        // No blueprint info means we can't filter -- show all non-wildcard plugins too
        if (!nameLC && !categoryLC) return true;

        for (const gameType of gameTypes) {
          const gt = gameType.toLowerCase();

          // Direct match against name or category
          if (nameLC.includes(gt) || categoryLC.includes(gt)) return true;

          // Check aliases: if the plugin targets "minecraft",
          // see if the blueprint name contains any minecraft alias
          const aliases = GAME_ALIASES[gt];
          if (aliases) {
            for (const alias of aliases) {
              if (nameLC.includes(alias)) return true;
            }
          }
        }

        return false;
      })
      .map((p) => this.serializePlugin(p));
  }

  /**
   * Get the hook registry for emitting events from route handlers.
   */
  getHookRegistry(): HookRegistry {
    return this.hookRegistry;
  }

  // ============================================
  // Plugin Storage API
  // ============================================

  async storageGet(pluginId: string, key: string, serverId?: string): Promise<unknown | null> {
    const plugin = await db.plugin.findUnique({ where: { pluginId } });
    if (!plugin) return null;

    const entry = await db.pluginStorage.findUnique({
      where: {
        pluginId_key_serverId: {
          pluginId: plugin.id,
          key,
          serverId: serverId || "",
        },
      },
    });
    return entry?.value ?? null;
  }

  async storageSet(
    pluginId: string,
    key: string,
    value: unknown,
    serverId?: string
  ): Promise<void> {
    const plugin = await db.plugin.findUnique({ where: { pluginId } });
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

    await db.pluginStorage.upsert({
      where: {
        pluginId_key_serverId: {
          pluginId: plugin.id,
          key,
          serverId: serverId || "",
        },
      },
      create: {
        pluginId: plugin.id,
        key,
        value: value as any,
        serverId: serverId || null,
      },
      update: {
        value: value as any,
      },
    });
  }

  async storageDelete(pluginId: string, key: string, serverId?: string): Promise<void> {
    const plugin = await db.plugin.findUnique({ where: { pluginId } });
    if (!plugin) return;

    await db.pluginStorage.deleteMany({
      where: {
        pluginId: plugin.id,
        key,
        serverId: serverId || null,
      },
    });
  }

  async storageKeys(pluginId: string, serverId?: string): Promise<string[]> {
    const plugin = await db.plugin.findUnique({ where: { pluginId } });
    if (!plugin) return [];

    const entries = await db.pluginStorage.findMany({
      where: {
        pluginId: plugin.id,
        ...(serverId ? { serverId } : {}),
      },
      select: { key: true },
    });
    return entries.map((e) => e.key);
  }

  // ============================================
  // Serialization & Security
  // ============================================

  /**
   * Filter out sensitive config fields before sending to frontend.
   * Identifies sensitive fields from configSchema and masks values.
   * Never expose API keys, passwords, or other secrets to the client.
   */
  private filterSensitiveConfig(
    config: Record<string, unknown>,
    configSchema: Record<string, unknown> | null
  ): Record<string, unknown> {
    if (!config || !configSchema) {
      return {};
    }

    const filtered = { ...config };
    const schema = configSchema as any;

    // Check if schema defines sensitive properties
    if (schema.properties && typeof schema.properties === "object") {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        const prop = propertySchema as any;

        // Check for sensitive field marker in schema
        if (prop.sensitive === true || prop.type === "password") {
          // Remove sensitive fields entirely - don't send to frontend
          delete filtered[key];
        }
      }
    }

    return filtered;
  }

  private serializePlugin(plugin: PluginRecord): PluginInfo {
    const configSchema = plugin.configSchema as Record<string, unknown> | null;

    return {
      id: plugin.id,
      pluginId: plugin.pluginId,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      license: plugin.license,
      category: plugin.category,
      icon: plugin.icon,
      homepage: plugin.homepage,
      repository: plugin.repository,
      status: plugin.status,
      isBuiltIn: plugin.isBuiltIn,
      error: plugin.error,
      gameTypes: plugin.gameTypes,
      permissions: plugin.permissions,
      // SECURITY: Filter out sensitive config fields before sending to client
      config: this.filterSensitiveConfig(
        plugin.config as Record<string, unknown>,
        configSchema
      ),
      defaultConfig: this.filterSensitiveConfig(
        plugin.defaultConfig as Record<string, unknown>,
        configSchema
      ),
      configSchema,
      uiMetadata: plugin.uiMetadata as Record<string, unknown> | null,
      manifest: plugin.manifest as unknown as PluginManifest,
      installedAt: plugin.installedAt.toISOString(),
      enabledAt: plugin.enabledAt?.toISOString() || null,
      updatedAt: plugin.updatedAt.toISOString(),
    };
  }
}

/** Singleton plugin manager instance */
export const pluginManager = new PluginManager();
