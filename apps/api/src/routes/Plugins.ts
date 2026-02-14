/**
 * StellarStack Plugin API Routes
 *
 * Handles all plugin management operations: listing, enabling,
 * disabling, configuration, and plugin-specific storage.
 */

import { Hono } from "hono";
import { pluginManager } from "../lib/PluginManager";
import { RequireAuth, RequireAdmin } from "../middleware/Auth";
import type { Variables } from "../Types";

export const plugins = new Hono<{ Variables: Variables }>();

// ============================================
// Public Routes (authenticated users)
// ============================================

/**
 * GET /api/plugins
 * List all plugins. Available to all authenticated users.
 * Users see enabled plugins, admins see all plugins.
 */
plugins.get("/", RequireAuth, async (c) => {
  try {
    const user = c.get("user");
    const allPlugins = await pluginManager.listPlugins();

    // Non-admins only see enabled plugins
    if (user.role !== "admin") {
      const enabledPlugins = allPlugins.filter((p) => p.status === "enabled");
      return c.json(enabledPlugins);
    }

    return c.json(allPlugins);
  } catch (error) {
    console.error("[Plugins] Failed to list plugins:", error);
    return c.json({ error: "Failed to list plugins" }, 500);
  }
});

/**
 * GET /api/plugins/:pluginId
 * Get a specific plugin by ID.
 */
plugins.get("/:pluginId", RequireAuth, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const plugin = await pluginManager.getPlugin(pluginId);

    if (!plugin) {
      return c.json({ error: "Plugin not found" }, 404);
    }

    return c.json(plugin);
  } catch (error) {
    console.error("[Plugins] Failed to get plugin:", error);
    return c.json({ error: "Failed to get plugin" }, 500);
  }
});

/**
 * GET /api/plugins/server/:serverId/tabs
 * Get plugins that provide server tabs for a specific server.
 * Filters by the server's blueprint category (game type).
 */
plugins.get("/server/:serverId/tabs", RequireAuth, async (c) => {
  try {
    const serverId = c.req.param("serverId");

    // Get the server's blueprint info for game type matching
    const { db } = await import("../lib/Db");
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: { blueprint: { select: { name: true, category: true } } },
    });

    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    // Pass both blueprint name and category for matching
    // Blueprint name is more reliable for game identification (e.g. "Paper", "Minecraft Vanilla")
    // Category is an organizational label (e.g. "gaming", "imported")
    const plugins = await pluginManager.getServerTabPlugins(
      server.blueprint?.name || undefined,
      server.blueprint?.category || undefined
    );

    return c.json(plugins);
  } catch (error) {
    console.error("[Plugins] Failed to get server tab plugins:", error);
    return c.json({ error: "Failed to get server tab plugins" }, 500);
  }
});

// ============================================
// Admin Routes (admin only)
// ============================================

/**
 * POST /api/plugins/:pluginId/enable
 * Enable a plugin. Admin only.
 */
plugins.post("/:pluginId/enable", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const plugin = await pluginManager.enablePlugin(pluginId);
    return c.json(plugin);
  } catch (error) {
    console.error("[Plugins] Failed to enable plugin:", error);
    const message = error instanceof Error ? error.message : "Failed to enable plugin";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/plugins/:pluginId/disable
 * Disable a plugin. Admin only.
 */
plugins.post("/:pluginId/disable", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const plugin = await pluginManager.disablePlugin(pluginId);
    return c.json(plugin);
  } catch (error) {
    console.error("[Plugins] Failed to disable plugin:", error);
    const message = error instanceof Error ? error.message : "Failed to disable plugin";
    return c.json({ error: message }, 400);
  }
});

/**
 * PATCH /api/plugins/:pluginId/config
 * Update plugin configuration. Admin only.
 */
plugins.patch("/:pluginId/config", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const config = await c.req.json();
    const plugin = await pluginManager.updatePluginConfig(pluginId, config);
    return c.json(plugin);
  } catch (error) {
    console.error("[Plugins] Failed to update plugin config:", error);
    const message = error instanceof Error ? error.message : "Failed to update config";
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /api/plugins/:pluginId
 * Uninstall a plugin (non-built-in only). Admin only.
 */
plugins.delete("/:pluginId", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    await pluginManager.uninstallPlugin(pluginId);
    return c.json({ success: true });
  } catch (error) {
    console.error("[Plugins] Failed to uninstall plugin:", error);
    const message = error instanceof Error ? error.message : "Failed to uninstall plugin";
    return c.json({ error: message }, 400);
  }
});

// ============================================
// Plugin Action Routes
// ============================================

/**
 * POST /api/plugins/:pluginId/actions/:actionId
 * Execute a plugin action.
 * Requires plugin permissions and user server access.
 */
plugins.post("/:pluginId/actions/:actionId", RequireAuth, async (c) => {
  try {
    const { pluginActionExecutor } = await import("../lib/PluginExecutor");
    const { requireServerAccess, requirePluginPermissions } = await import(
      "../middleware/PluginAuth"
    );
    const { pluginAuditLogger } = await import("../lib/PluginAudit");

    const pluginId = c.req.param("pluginId");
    const actionId = c.req.param("actionId");
    const user = c.get("user");
    const request = await c.req.json();

    // Verify server access
    if (!request.serverId) {
      return c.json({ error: "serverId is required" }, 400);
    }

    // Check user has admin access or server access
    const { db } = await import("../lib/Db");
    if (user.role !== "admin") {
      const member = await db.serverMember.findUnique({
        where: {
          serverId_userId: {
            userId: user.id,
            serverId: request.serverId,
          },
        },
      });

      if (!member) {
        await pluginAuditLogger.logDeniedAction(
          pluginId,
          actionId,
          user.id,
          request.serverId,
          "User lacks server control permission"
        );
        return c.json({ error: "Access denied to this server" }, 403);
      }
    }

    // Load plugin
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin || plugin.status !== "enabled") {
      return c.json(
        { error: "Plugin not found or not enabled" },
        plugin ? 400 : 404
      );
    }

    // Check plugin has required permissions for this action
    const manifest = plugin.manifest as unknown as import("../lib/PluginManager").PluginManifest;
    const action = manifest.actions?.find((a) => a.id === actionId);

    if (!action) {
      return c.json({ error: "Action not found" }, 404);
    }

    // Check if action requires confirmation
    if (action.dangerous && !request.confirmed) {
      return c.json(
        {
          error: "This action is dangerous and requires confirmation",
          requiresConfirmation: true,
          action: {
            id: actionId,
            label: action.label,
            description: action.description,
          },
        },
        400
      );
    }

    // Execute action with audit logging
    const startTime = Date.now();
    const server = await db.server.findUnique({ where: { id: request.serverId } });

    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    const context = {
      pluginId,
      manifest,
      serverId: request.serverId,
      server,
      config: plugin.config as Record<string, unknown>,
      userId: user.id,
    };

    const result = await pluginActionExecutor.executeAction(
      pluginId,
      actionId,
      request,
      context
    );

    const duration = Date.now() - startTime;

    // Log audit entry
    if (result.success) {
      await pluginAuditLogger.logAction({
        pluginId,
        actionId,
        userId: user.id,
        serverId: request.serverId,
        params: request.inputs || {},
        result: "success",
        executedOperations: result.executedOperations,
        duration,
        timestamp: new Date(),
      });
    } else {
      await pluginAuditLogger.logAction({
        pluginId,
        actionId,
        userId: user.id,
        serverId: request.serverId,
        params: request.inputs || {},
        result: "error",
        errorMessage: result.error,
        executedOperations: result.executedOperations,
        duration,
        timestamp: new Date(),
      });
    }

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    console.error("[Plugins] Failed to execute action:", error);
    return c.json({ error: "Failed to execute action" }, 500);
  }
});

// ============================================
// Plugin Storage Routes
// ============================================

/**
 * GET /api/plugins/:pluginId/storage/:key
 * Get a value from plugin storage.
 */
plugins.get("/:pluginId/storage/:key", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const key = c.req.param("key");
    const serverId = c.req.query("serverId");
    const value = await pluginManager.storageGet(pluginId, key, serverId);
    return c.json({ key, value });
  } catch (error) {
    return c.json({ error: "Failed to get storage value" }, 500);
  }
});

/**
 * PUT /api/plugins/:pluginId/storage/:key
 * Set a value in plugin storage.
 */
plugins.put("/:pluginId/storage/:key", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const key = c.req.param("key");
    const body = await c.req.json();
    const serverId = body.serverId;
    await pluginManager.storageSet(pluginId, key, body.value, serverId);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to set storage value" }, 500);
  }
});

// ============================================
// CurseForge Proxy Routes
// ============================================

/**
 * GET /api/plugins/curseforge/search
 * Proxy search requests to the CurseForge API.
 * This avoids CORS issues and hides the API key from the client.
 */
plugins.get("/curseforge/search", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("curseforge-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "CurseForge plugin is not enabled" }, 400);
    }

    const config = plugin.config as { apiKey?: string };
    if (!config.apiKey) {
      return c.json(
        { error: "CurseForge API key not configured. Please set it in plugin settings." },
        400
      );
    }

    const searchQuery = c.req.query("query") || "";
    const pageSize = c.req.query("pageSize") || "20";
    const index = c.req.query("index") || "0";
    const sortField = c.req.query("sortField") || "2"; // Popularity
    const sortOrder = c.req.query("sortOrder") || "desc";
    const gameVersion = c.req.query("gameVersion") || "";
    const modLoaderType = c.req.query("modLoaderType") || "";

    // CurseForge API: Search modpacks (classId=4471 for modpacks)
    const params = new URLSearchParams({
      gameId: "432", // Minecraft
      classId: "4471", // Modpacks
      searchFilter: searchQuery,
      pageSize,
      index,
      sortField,
      sortOrder,
    });

    if (gameVersion) params.set("gameVersion", gameVersion);
    if (modLoaderType) params.set("modLoaderType", modLoaderType);

    const response = await fetch(`https://api.curseforge.com/v1/mods/search?${params.toString()}`, {
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CurseForge] API error:", response.status, errorText);
      return c.json(
        { error: "CurseForge API error", status: response.status },
        response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503
      );
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[CurseForge] Search error:", error);
    return c.json({ error: "Failed to search CurseForge" }, 500);
  }
});

/**
 * GET /api/plugins/curseforge/mod/:modId
 * Get details for a specific CurseForge mod/modpack.
 */
plugins.get("/curseforge/mod/:modId", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("curseforge-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "CurseForge plugin is not enabled" }, 400);
    }

    const config = plugin.config as { apiKey?: string };
    if (!config.apiKey) {
      return c.json({ error: "CurseForge API key not configured" }, 400);
    }

    const modId = c.req.param("modId");
    const response = await fetch(`https://api.curseforge.com/v1/mods/${modId}`, {
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return c.json({ error: "CurseForge API error" }, response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503);
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[CurseForge] Mod detail error:", error);
    return c.json({ error: "Failed to get mod details" }, 500);
  }
});

/**
 * GET /api/plugins/curseforge/mod/:modId/files
 * Get files (versions) for a CurseForge mod/modpack.
 */
plugins.get("/curseforge/mod/:modId/files", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("curseforge-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "CurseForge plugin is not enabled" }, 400);
    }

    const config = plugin.config as { apiKey?: string };
    if (!config.apiKey) {
      return c.json({ error: "CurseForge API key not configured" }, 400);
    }

    const modId = c.req.param("modId");
    const gameVersion = c.req.query("gameVersion") || "";
    const modLoaderType = c.req.query("modLoaderType") || "";

    const params = new URLSearchParams();
    if (gameVersion) params.set("gameVersion", gameVersion);
    if (modLoaderType) params.set("modLoaderType", modLoaderType);

    const url = `https://api.curseforge.com/v1/mods/${modId}/files${params.toString() ? "?" + params.toString() : ""}`;

    const response = await fetch(url, {
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return c.json({ error: "CurseForge API error" }, response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503);
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[CurseForge] Files error:", error);
    return c.json({ error: "Failed to get mod files" }, 500);
  }
});

/**
 * POST /api/plugins/curseforge/install
 * Install a CurseForge modpack on a server.
 * This downloads the modpack server files and configures the server.
 */
plugins.post("/curseforge/install", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("curseforge-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "CurseForge plugin is not enabled" }, 400);
    }

    const config = plugin.config as {
      apiKey?: string;
      autoRestart?: boolean;
      backupBeforeInstall?: boolean;
    };
    if (!config.apiKey) {
      return c.json({ error: "CurseForge API key not configured" }, 400);
    }

    const body = await c.req.json();
    const { serverId, modId, fileId } = body;

    if (!serverId || !modId || !fileId) {
      return c.json({ error: "serverId, modId, and fileId are required" }, 400);
    }

    // Get the file download URL from CurseForge
    const fileResponse = await fetch(
      `https://api.curseforge.com/v1/mods/${modId}/files/${fileId}/download-url`,
      {
        headers: {
          "x-api-key": config.apiKey,
          Accept: "application/json",
        },
      }
    );

    if (!fileResponse.ok) {
      return c.json({ error: "Failed to get download URL from CurseForge" }, 400);
    }

    const fileData = await fileResponse.json();
    const downloadUrl = fileData.data;

    if (!downloadUrl) {
      return c.json({ error: "No download URL available for this file" }, 400);
    }

    // Store the installation info in plugin storage
    await pluginManager.storageSet(
      "curseforge-installer",
      `install:${serverId}`,
      {
        modId,
        fileId,
        downloadUrl,
        status: "pending",
        startedAt: new Date().toISOString(),
      },
      serverId
    );

    return c.json({
      success: true,
      downloadUrl,
      message:
        "Modpack installation initiated. The server files will be downloaded and configured.",
    });
  } catch (error) {
    console.error("[CurseForge] Install error:", error);
    return c.json({ error: "Failed to install modpack" }, 500);
  }
});

// ============================================
// Modrinth Proxy Routes
// ============================================

const MODRINTH_API = "https://api.modrinth.com/v2";

/**
 * GET /api/plugins/modrinth/search
 * Proxy search requests to the Modrinth API.
 */
plugins.get("/modrinth/search", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("modrinth-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "Modrinth plugin is not enabled" }, 400);
    }

    // Forward all query parameters to Modrinth
    const params = new URLSearchParams();
    const query = c.req.query("query");
    const facets = c.req.query("facets");
    const limit = c.req.query("limit") || "20";
    const offset = c.req.query("offset") || "0";
    const index = c.req.query("index") || "downloads";

    if (query) params.set("query", query);
    if (facets) params.set("facets", facets);
    params.set("limit", limit);
    params.set("offset", offset);
    params.set("index", index);

    const response = await fetch(`${MODRINTH_API}/search?${params.toString()}`, {
      headers: {
        "User-Agent": "StellarStack/1.0 (https://stellarstack.dev)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Modrinth] API error:", response.status, errorText);
      return c.json(
        { error: "Modrinth API error", status: response.status },
        response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503
      );
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[Modrinth] Search error:", error);
    return c.json({ error: "Failed to search Modrinth" }, 500);
  }
});

/**
 * GET /api/plugins/modrinth/project/:slugOrId
 * Get project details from Modrinth.
 */
plugins.get("/modrinth/project/:slugOrId", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("modrinth-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "Modrinth plugin is not enabled" }, 400);
    }

    const slugOrId = c.req.param("slugOrId");
    const response = await fetch(`${MODRINTH_API}/project/${slugOrId}`, {
      headers: {
        "User-Agent": "StellarStack/1.0 (https://stellarstack.dev)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return c.json({ error: "Modrinth API error" }, response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503);
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[Modrinth] Project detail error:", error);
    return c.json({ error: "Failed to get project details" }, 500);
  }
});

/**
 * GET /api/plugins/modrinth/project/:slugOrId/versions
 * Get versions for a Modrinth project.
 */
plugins.get("/modrinth/project/:slugOrId/versions", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("modrinth-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "Modrinth plugin is not enabled" }, 400);
    }

    const slugOrId = c.req.param("slugOrId");
    const response = await fetch(`${MODRINTH_API}/project/${slugOrId}/version`, {
      headers: {
        "User-Agent": "StellarStack/1.0 (https://stellarstack.dev)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return c.json({ error: "Modrinth API error" }, response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503);
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[Modrinth] Versions error:", error);
    return c.json({ error: "Failed to get project versions" }, 500);
  }
});

/**
 * POST /api/plugins/modrinth/install
 * Install a Modrinth modpack on a server.
 */
plugins.post("/modrinth/install", RequireAuth, async (c) => {
  try {
    const plugin = await pluginManager.getPlugin("modrinth-installer");
    if (!plugin || plugin.status !== "enabled") {
      return c.json({ error: "Modrinth plugin is not enabled" }, 400);
    }

    const body = await c.req.json();
    const { serverId, projectSlug, versionId } = body;

    if (!serverId || !projectSlug) {
      return c.json({ error: "serverId and projectSlug are required" }, 400);
    }

    // If versionId is provided, get that version. Otherwise get the latest.
    let downloadUrl: string | null = null;
    let versionName = "latest";

    if (versionId) {
      const versionRes = await fetch(`${MODRINTH_API}/version/${versionId}`, {
        headers: {
          "User-Agent": "StellarStack/1.0 (https://stellarstack.dev)",
          Accept: "application/json",
        },
      });
      if (!versionRes.ok) {
        return c.json({ error: "Failed to get version from Modrinth" }, 400);
      }
      const versionData = await versionRes.json();
      versionName = versionData.name || versionId;
      if (versionData.files?.[0]?.url) {
        downloadUrl = versionData.files[0].url;
      }
    } else {
      // Get project versions and pick the first (latest)
      const versionsRes = await fetch(`${MODRINTH_API}/project/${projectSlug}/version`, {
        headers: {
          "User-Agent": "StellarStack/1.0 (https://stellarstack.dev)",
          Accept: "application/json",
        },
      });
      if (!versionsRes.ok) {
        return c.json({ error: "Failed to get versions from Modrinth" }, 400);
      }
      const versions = await versionsRes.json();
      if (versions.length > 0 && versions[0].files?.[0]?.url) {
        downloadUrl = versions[0].files[0].url;
        versionName = versions[0].name || "latest";
      }
    }

    if (!downloadUrl) {
      return c.json({ error: "No download URL available" }, 400);
    }

    // Store installation info in plugin storage
    await pluginManager.storageSet(
      "modrinth-installer",
      `install:${serverId}`,
      {
        projectSlug,
        versionId,
        versionName,
        downloadUrl,
        status: "pending",
        startedAt: new Date().toISOString(),
      },
      serverId
    );

    return c.json({
      success: true,
      message: `Modpack installation initiated (${versionName}). The server files will be downloaded and configured.`,
    });
  } catch (error) {
    console.error("[Modrinth] Install error:", error);
    return c.json({ error: "Failed to install modpack" }, 500);
  }
});

// ============================================
// Plugin Audit and Statistics Routes
// ============================================

/**
 * GET /api/plugins/:pluginId/stats
 * Get plugin statistics and usage metrics (admin only).
 */
plugins.get("/:pluginId/stats", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const days = parseInt(c.req.query("days") || "30", 10);

    const { pluginAuditLogger } = await import("../lib/PluginAudit");
    const stats = await pluginAuditLogger.getPluginStatistics(pluginId, Math.min(days, 365));

    return c.json(stats);
  } catch (error) {
    console.error("[Plugins] Failed to get plugin stats:", error);
    return c.json({ error: "Failed to get plugin statistics" }, 500);
  }
});

/**
 * GET /api/plugins/audit
 * Query audit log with filtering (admin only).
 */
plugins.get("/audit", RequireAdmin, async (c) => {
  try {
    const { pluginAuditLogger } = await import("../lib/PluginAudit");

    const filter = {
      pluginId: c.req.query("pluginId"),
      userId: c.req.query("userId"),
      serverId: c.req.query("serverId"),
      result: c.req.query("result") as "success" | "error" | "denied" | undefined,
      limit: parseInt(c.req.query("limit") || "100", 10),
      offset: parseInt(c.req.query("offset") || "0", 10),
    };

    const entries = await pluginAuditLogger.queryAuditLog(filter);
    return c.json(entries);
  } catch (error) {
    console.error("[Plugins] Failed to query audit log:", error);
    return c.json({ error: "Failed to query audit log" }, 500);
  }
});

/**
 * GET /api/plugins/:pluginId/security
 * Get plugin security analysis and suspicious activity alerts (admin only).
 */
plugins.get("/:pluginId/security", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");

    const { pluginAuditLogger } = await import("../lib/PluginAudit");
    const alerts = await pluginAuditLogger.detectSuspiciousActivity(pluginId);

    return c.json({ alerts });
  } catch (error) {
    console.error("[Plugins] Failed to get plugin security info:", error);
    return c.json({ error: "Failed to get security information" }, 500);
  }
});

// ============================================
// Plugin Installation Routes (Git-based)
// ============================================

/**
 * POST /api/plugins/install
 * Install a plugin from a Git repository.
 * Admin only.
 */
plugins.post("/install", RequireAdmin, async (c) => {
  try {
    const { pluginInstaller } = await import("../lib/PluginInstaller");
    const { repoUrl, branch } = await c.req.json();

    if (!repoUrl) {
      return c.json({ error: "repoUrl is required" }, 400);
    }

    console.log(`[Plugins] Installing plugin from ${repoUrl}...`);

    const plugin = await pluginInstaller.installFromGit({
      repoUrl,
      branch: branch || "main",
      trustLevel: "community",
    }) as { pluginId: string; name: string };

    console.log(`[Plugins] Plugin ${plugin.pluginId} installed successfully`);

    return c.json({
      success: true,
      plugin,
      message: `Plugin "${plugin.name}" installed successfully`,
    });
  } catch (error) {
    console.error("[Plugins] Failed to install plugin:", error);
    const message = error instanceof Error ? error.message : "Failed to install plugin";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/plugins/:pluginId/update
 * Update an installed plugin from its Git repository.
 * Admin only.
 */
plugins.post("/:pluginId/update", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const { pluginInstaller } = await import("../lib/PluginInstaller");

    console.log(`[Plugins] Updating plugin ${pluginId}...`);

    const plugin = await pluginInstaller.update(pluginId) as { pluginId: string; name: string };

    console.log(`[Plugins] Plugin ${pluginId} updated successfully`);

    return c.json({
      success: true,
      plugin,
      message: `Plugin "${plugin.name}" updated successfully`,
    });
  } catch (error) {
    console.error("[Plugins] Failed to update plugin:", error);
    const message = error instanceof Error ? error.message : "Failed to update plugin";
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/plugins/:pluginId/security-report
 * Get the security analysis report for a plugin.
 * This is distinct from the security alerts (suspicious activity).
 * Admin only.
 */
plugins.get("/:pluginId/security-report", RequireAdmin, async (c) => {
  try {
    const pluginId = c.req.param("pluginId");
    const { db } = await import("../lib/Db");

    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      return c.json({ error: "Plugin not found" }, 404);
    }

    const pluginRecord = plugin as unknown as Record<string, unknown>;
    const report = (pluginRecord.securityReport as Record<string, unknown>) || {
      score: 100,
      riskLevel: "safe",
      issues: [],
      warnings: [],
    };

    return c.json({
      pluginId,
      name: plugin.name,
      trustLevel: (pluginRecord.trustLevel as string) || "community",
      securityScore: (pluginRecord.securityScore as number) || 100,
      securityReport: report,
      analyzedAt: pluginRecord.lastChecked,
    });
  } catch (error) {
    console.error("[Plugins] Failed to get security report:", error);
    return c.json({ error: "Failed to get security report" }, 500);
  }
});
