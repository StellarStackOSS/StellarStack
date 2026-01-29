/**
 * StellarStack Plugin API Routes
 *
 * Handles all plugin management operations: listing, enabling,
 * disabling, configuration, and plugin-specific storage.
 */

import { Hono } from "hono";
import { pluginManager } from "../lib/plugin-manager";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { Variables } from "../types";

export const plugins = new Hono<{ Variables: Variables }>();

// ============================================
// Public Routes (authenticated users)
// ============================================

/**
 * GET /api/plugins
 * List all plugins. Available to all authenticated users.
 * Users see enabled plugins, admins see all plugins.
 */
plugins.get("/", requireAuth, async (c) => {
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
plugins.get("/:pluginId", requireAuth, async (c) => {
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
plugins.get("/server/:serverId/tabs", requireAuth, async (c) => {
  try {
    const serverId = c.req.param("serverId");

    // Get the server's blueprint category
    const { db } = await import("../lib/db");
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: { blueprint: { select: { category: true } } },
    });

    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    const plugins = await pluginManager.getServerTabPlugins(server.blueprint.category || undefined);

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
plugins.post("/:pluginId/enable", requireAdmin, async (c) => {
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
plugins.post("/:pluginId/disable", requireAdmin, async (c) => {
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
plugins.patch("/:pluginId/config", requireAdmin, async (c) => {
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
plugins.delete("/:pluginId", requireAdmin, async (c) => {
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
// Plugin Storage Routes
// ============================================

/**
 * GET /api/plugins/:pluginId/storage/:key
 * Get a value from plugin storage.
 */
plugins.get("/:pluginId/storage/:key", requireAdmin, async (c) => {
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
plugins.put("/:pluginId/storage/:key", requireAdmin, async (c) => {
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
plugins.get("/curseforge/search", requireAuth, async (c) => {
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
        response.status as any
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
plugins.get("/curseforge/mod/:modId", requireAuth, async (c) => {
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
      return c.json({ error: "CurseForge API error" }, response.status as any);
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
plugins.get("/curseforge/mod/:modId/files", requireAuth, async (c) => {
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
      return c.json({ error: "CurseForge API error" }, response.status as any);
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
plugins.post("/curseforge/install", requireAuth, async (c) => {
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
plugins.get("/modrinth/search", requireAuth, async (c) => {
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
        response.status as any
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
plugins.get("/modrinth/project/:slugOrId", requireAuth, async (c) => {
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
      return c.json({ error: "Modrinth API error" }, response.status as any);
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
plugins.get("/modrinth/project/:slugOrId/versions", requireAuth, async (c) => {
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
      return c.json({ error: "Modrinth API error" }, response.status as any);
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
plugins.post("/modrinth/install", requireAuth, async (c) => {
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
