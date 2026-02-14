import { Context, Next } from "hono";
import { auth } from "../lib/Auth";
import { db } from "../lib/Db";
import { VerifyToken } from "../lib/Crypto";
import { HasPermission, Permission, PERMISSIONS } from "../lib/Permissions";
import type { SessionUser, ServerAccessContext } from "./AuthTypes";

// Re-export types for backwards compatibility
export type { SessionUser, ServerAccessContext } from "./AuthTypes";

// Middleware to require authenticated user
export const RequireAuth = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user as unknown as SessionUser);
  c.set("session", session.session);

  return next();
};

// Middleware to require admin role
export const RequireAdmin = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = session.user as unknown as SessionUser;

  if (user.role !== "admin") {
    return c.json({ error: "Forbidden: Admin access required" }, 403);
  }

  c.set("user", user);
  c.set("session", session.session);

  return next();
};

// Middleware for daemon authentication (using node token)
// Supports both formats:
// - "Bearer {token}" (legacy)
// - "Bearer {token_id}.{token}" (new format from Rust daemon)
export const RequireDaemon = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing daemon token" }, 401);
  }

  const tokenPart = authHeader.slice(7);

  let nodeId: string | null = null;
  let token: string;

  // Check if token is in "token_id.token" format
  if (tokenPart.includes(".")) {
    const dotIndex = tokenPart.indexOf(".");
    nodeId = tokenPart.slice(0, dotIndex);
    token = tokenPart.slice(dotIndex + 1);
  } else {
    token = tokenPart;
  }

  // Find node by token (and optionally by ID)
  const node = await db.node.findFirst({
    where: nodeId ? { id: nodeId, token: token } : { token: token },
  });

  if (!node) {
    return c.json({ error: "Invalid daemon token" }, 401);
  }

  // Verify token hash
  if (!VerifyToken(token, node.tokenHash)) {
    return c.json({ error: "Invalid daemon token" }, 401);
  }

  // Update last heartbeat
  await db.node.update({
    where: { id: node.id },
    data: {
      isOnline: true,
      lastHeartbeat: new Date(),
    },
  });

  c.set("node", node);

  return next();
};

// Middleware to check server ownership or membership
export const RequireServerAccess = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = session.user as unknown as SessionUser;
  const serverId = c.req.param("serverId");

  if (!serverId) {
    return c.json({ error: "Server ID required" }, 400);
  }

  const server = await db.server.findUnique({
    where: { id: serverId },
  });

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const isAdmin = user.role === "admin";
  const isOwner = server.ownerId === user.id;

  // Check if user is a member with permissions
  let isMember = false;
  let permissions: string[] = [];

  if (!isAdmin && !isOwner) {
    const membership = await db.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId,
          userId: user.id,
        },
      },
    });

    if (membership) {
      isMember = true;
      permissions = membership.permissions;
    }
  }

  // Admins and owners have all permissions
  if (isAdmin || isOwner) {
    permissions = ["*"];
  }

  // If not admin, owner, or member, deny access
  if (!isAdmin && !isOwner && !isMember) {
    return c.json({ error: "Forbidden: You don't have access to this server" }, 403);
  }

  c.set("user", user);
  c.set("server", server);
  c.set("serverAccess", {
    server,
    isOwner,
    isAdmin,
    isMember,
    permissions,
  } as ServerAccessContext);

  return next();
};

// Factory function to create permission middleware
export const RequirePermission = (...requiredPermissions: Permission[]) => {
  return async (c: Context, next: Next) => {
    const serverAccess = c.get("serverAccess") as ServerAccessContext | undefined;

    if (!serverAccess) {
      return c.json({ error: "Server access context not available" }, 500);
    }

    // Admins and owners have all permissions
    if (serverAccess.isAdmin || serverAccess.isOwner) {
      return next();
    }

    // Check if user has required permission
    const hasRequiredPermission = requiredPermissions.some((perm) =>
      HasPermission(serverAccess.permissions, perm)
    );

    if (!hasRequiredPermission) {
      return c.json(
        {
          error: "Forbidden: Missing required permission",
          required: requiredPermissions,
        },
        403
      );
    }

    return next();
  };
};

// Helper to check permission in route handlers
export const CheckPermission = (c: Context, permission: Permission): boolean => {
  const serverAccess = c.get("serverAccess") as ServerAccessContext | undefined;

  if (!serverAccess) {
    return false;
  }

  if (serverAccess.isAdmin || serverAccess.isOwner) {
    return true;
  }

  return HasPermission(serverAccess.permissions, permission);
};

// Middleware to block actions on suspended servers (use after requireServerAccess)
export const RequireNotSuspended = async (c: Context, next: Next) => {
  const serverAccess = c.get("serverAccess") as ServerAccessContext | undefined;
  const user = c.get("user") as SessionUser | undefined;

  if (!serverAccess) {
    return c.json({ error: "Server access context not available" }, 500);
  }

  // Admins can still perform actions on suspended servers
  if (user?.role === "admin") {
    return next();
  }

  if (serverAccess.server.status === "SUSPENDED") {
    return c.json({ error: "This server is suspended. Contact an administrator." }, 403);
  }

  return next();
};
