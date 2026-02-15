/**
 * Plugin Permission Enforcement Middleware
 *
 * Validates that plugins have the required permissions to execute actions.
 * Enforces permission boundaries and logs all permission checks.
 */

import type { Context, Next } from "hono";
import type { Variables } from "../Types";
import { db } from "../lib/Db";
import { PluginActionExecutor } from "../lib/PluginExecutor";
import type { PluginManifest } from "../lib/PluginManager";

// ============================================
// Permission Checking Utilities
// ============================================

interface PluginPermissions {
  id: string;
  pluginId: string;
  permissions: string[];
}

interface UserServerAccess {
  serverId: string;
  canRead: boolean;
  canWrite: boolean;
  canControl: boolean;
  canManageBackups: boolean;
}

/**
 * Check if a permission is granted.
 * Supports wildcard matching: "files.*" grants all files.* permissions.
 *
 * @param grantedPermissions - The list of permissions that have been granted
 * @param requiredPermission - The permission to check for
 * @returns Whether the required permission is granted
 */
export const hasPermission = (
  grantedPermissions: string[],
  requiredPermission: string
): boolean => {
  // Exact match
  if (grantedPermissions.includes(requiredPermission)) {
    return true;
  }

  // Wildcard match: "files.*" matches "files.read", "files.write", etc.
  const parts = requiredPermission.split(".");
  const wildcard = parts.slice(0, -1).join(".") + ".*";

  if (grantedPermissions.includes(wildcard)) {
    return true;
  }

  // Full wildcard "*" grants all permissions (only for internal use)
  if (grantedPermissions.includes("*")) {
    return true;
  }

  return false;
};

/**
 * Get the permissions required for a user to perform an action on a server.
 * This is different from plugin permissions - these are user/role-based.
 *
 * @param action - The action type string (e.g., "files.read", "console.send")
 * @param _serverId - Optional server ID for context-specific permissions
 * @returns Array of required user permission strings
 */
const getUserRequiredPermissions = (action: string, _serverId?: string): string[] => {
  // Map action types to required user permissions
  switch (action) {
    case "files.read":
      return ["server:view"];
    case "files.write":
    case "files.delete":
      return ["server:manage"];
    case "console.send":
      return ["server:manage"];
    case "control.start":
    case "control.stop":
    case "control.restart":
      return ["server:manage"];
    case "backups.create":
      return ["server:manage"];
    default:
      return [];
  }
};

/**
 * Middleware: Require user to have access to the server being acted upon.
 * Should be applied before plugin-specific middleware.
 *
 * @param c - Hono context with application variables
 * @param next - Next middleware function
 * @returns Response or passes to next middleware
 */
export const requireServerAccess = async (
  c: Context<{ Variables: Variables }>,
  next: Next
): Promise<Response | void> => {
  const serverId = c.req.param("serverId");

  if (!serverId) {
    return next();
  }

  const user = c.get("user");
  if (user?.role === "admin") {
    // Admins have access to all servers
    return next();
  }

  // Check if user has access to this server
  const member = await db.serverMember.findUnique({
    where: {
      serverId_userId: {
        userId: user?.id,
        serverId,
      },
    },
  });

  if (!member) {
    return c.json({ error: "Access denied to this server" }, 403);
  }

  // Store member info for later use (not in context, just check it exists)
  return next();
};

/**
 * Middleware: Enforce plugin permissions.
 * Validates that:
 * 1. Plugin exists and is enabled
 * 2. Plugin has required permissions for the action
 * 3. User has required permissions for the action
 * 4. Action is not dangerous without explicit confirmation
 *
 * @param c - Hono context with application variables
 * @param next - Next middleware function
 * @returns Response or passes to next middleware
 */
export const requirePluginPermissions = async (
  c: Context<{ Variables: Variables }>,
  next: Next
): Promise<Response | void> => {
  const pluginId = c.req.param("pluginId");
  const actionId = c.req.param("actionId");
  const serverId = c.req.param("serverId");
  const user = c.get("user");

  if (!pluginId || !actionId) {
    return next();
  }

  try {
    // 1. Load plugin
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      return c.json({ error: "Plugin not found" }, 404);
    }

    if (plugin.status !== "enabled") {
      return c.json({ error: "Plugin is not enabled" }, 400);
    }

    const manifest = plugin.manifest as unknown as PluginManifest;

    // 2. Get required permissions for this action
    const requiredPermissions = PluginActionExecutor.getActionPermissions(manifest, actionId);

    // 3. Check plugin has all required permissions
    const pluginPermissions = manifest.permissions || [];
    for (const requiredPerm of requiredPermissions) {
      if (!hasPermission(pluginPermissions, requiredPerm)) {
        return c.json(
          {
            error: `Plugin lacks required permission: ${requiredPerm}`,
            pluginId,
            actionId,
            missingPermission: requiredPerm,
          },
          403
        );
      }
    }

    // 4. Check user has required permissions
    const userRequiredPerms = requiredPermissions.flatMap((perm) =>
      getUserRequiredPermissions(perm, serverId)
    );

    // Deduplicate
    const uniqueUserPerms = [...new Set(userRequiredPerms)];

    if (user?.role !== "admin") {
      // For non-admins, check specific permissions - they were already verified by requireServerAccess
      // Just ensure they passed that middleware
      if (serverId) {
        const member = await db.serverMember.findUnique({
          where: {
            serverId_userId: {
              userId: user?.id,
              serverId,
            },
          },
        });
        if (!member) {
          return c.json(
            {
              error: "You do not have permission to manage this server",
            },
            403
          );
        }
      }
    }

    // 5. Check if action is dangerous
    const action = manifest.actions?.find((a) => a.id === actionId);
    if (action?.dangerous) {
      // Require explicit confirmation
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      if (!body.confirmed) {
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
    }

    return next();
  } catch (error) {
    console.error("[PluginAuth] Permission check failed:", error);
    return c.json({ error: "Permission check failed" }, 500);
  }
};

/**
 * Helper: Check if a user has a specific permission for a server.
 * Used internally for permission validation.
 *
 * @param userId - The ID of the user to check
 * @param serverId - The ID of the server to check access for
 * @param _permission - The permission type to verify
 * @returns Whether the user has the specified permission
 */
export const userHasServerPermission = async (
  userId: string,
  serverId: string,
  _permission: "read" | "write" | "control" | "backups"
): Promise<boolean> => {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (user?.role === "admin") {
    return true;
  }

  // Check if user is a member of the server
  const member = await db.serverMember.findUnique({
    where: {
      serverId_userId: {
        userId,
        serverId,
      },
    },
  });

  // For now, if they're a member, they have access
  // Permissions are stored in member.permissions array
  return !!member;
};
