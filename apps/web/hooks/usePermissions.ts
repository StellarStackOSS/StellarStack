"use client";

import { useMemo } from "react";
import { useAuth } from "hooks/auth-provider";
import { useServer } from "components/ServerStatusPages/server-provider";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  Permission,
  PERMISSIONS,
} from "@/lib/permissions";

interface UsePermissionsResult {
  // The user's permissions for the current server
  permissions: string[];

  // Whether the user is the server owner
  isOwner: boolean;

  // Whether the user is an admin
  isAdmin: boolean;

  // Whether the user has full access (owner or admin)
  hasFullAccess: boolean;

  // Check if user has a specific permission
  can: (permission: Permission) => boolean;

  // Check if user has any of the given permissions
  canAny: (...permissions: Permission[]) => boolean;

  // Check if user has all of the given permissions
  canAll: (...permissions: Permission[]) => boolean;
}

/**
 * Hook to check user permissions for the current server context
 *
 * Usage:
 * const { can } = usePermissions();
 * if (can(PERMISSIONS.CONSOLE_WRITE)) {
 *   // Show command input
 * }
 */
export const usePermissions = (): UsePermissionsResult => {
  const { user, isAdmin } = useAuth();
  const { server, serverAccess } = useServer();

  const result = useMemo<UsePermissionsResult>(() => {
    const isOwner = server?.ownerId === user?.id;
    const hasFullAccess = isAdmin || isOwner;

    // Get permissions from serverAccess or default to owner/admin having all
    const permissions = serverAccess?.permissions ?? (hasFullAccess ? ["*"] : []);

    const can = (permission: Permission): boolean => {
      if (hasFullAccess) return true;
      return hasPermission(permissions, permission);
    };

    const canAny = (...perms: Permission[]): boolean => {
      if (hasFullAccess) return true;
      return hasAnyPermission(permissions, perms);
    };

    const canAll = (...perms: Permission[]): boolean => {
      if (hasFullAccess) return true;
      return hasAllPermissions(permissions, perms);
    };

    return {
      permissions,
      isOwner,
      isAdmin,
      hasFullAccess,
      can,
      canAny,
      canAll,
    };
  }, [user, server, serverAccess, isAdmin]);

  return result;
};

// Export PERMISSIONS for convenience
export { PERMISSIONS };
