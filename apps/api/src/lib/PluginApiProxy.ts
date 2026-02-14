/**
 * StellarStack Plugin API Proxy
 *
 * Provides permission-checked API access to plugins.
 * All API calls from workers are validated against plugin permissions.
 */

import { db } from './Db';

// ============================================
// Permission Mapping
// ============================================

const API_PERMISSION_MAP: Record<string, string> = {
  // Server API
  'GET /api/servers': 'servers.read',
  'GET /api/servers/:serverId': 'servers.read',
  'PATCH /api/servers/:serverId': 'servers.write',

  // Files API
  'GET /api/servers/:serverId/files': 'files.read',
  'POST /api/servers/:serverId/files': 'files.write',
  'DELETE /api/servers/:serverId/files': 'files.delete',

  // Console API
  'POST /api/servers/:serverId/console': 'console.send',

  // Control API
  'POST /api/servers/:serverId/start': 'control.start',
  'POST /api/servers/:serverId/stop': 'control.stop',
  'POST /api/servers/:serverId/restart': 'control.restart',

  // Backups
  'POST /api/servers/:serverId/backups': 'backups.create',

  // Activity/Logs
  'GET /api/servers/:serverId/activity': 'activity.read',
};

// ============================================
// API Proxy
// ============================================

export class PluginAPIProxy {
  /**
   * Check if a plugin has permission for an API call
   */
  static checkPermission(method: string, endpoint: string, pluginPermissions: string[]): boolean {
    // Build the permission key
    const key = `${method} ${endpoint}`;

    // Check for exact match
    const requiredPerm = API_PERMISSION_MAP[key];
    if (requiredPerm) {
      return this.hasPermission(pluginPermissions, requiredPerm);
    }

    // Check for wildcard patterns
    for (const [pattern, requiredPerm] of Object.entries(API_PERMISSION_MAP)) {
      if (this.patternMatches(pattern, key)) {
        return this.hasPermission(pluginPermissions, requiredPerm);
      }
    }

    // No permission rule found - deny by default
    return false;
  }

  /**
   * Check if plugin has a specific permission (supports wildcards)
   */
  private static hasPermission(pluginPermissions: string[], requiredPerm: string): boolean {
    for (const perm of pluginPermissions) {
      // Exact match
      if (perm === requiredPerm) {
        return true;
      }

      // Wildcard match (e.g., "files.*" matches "files.read")
      if (perm.endsWith('.*')) {
        const prefix = perm.slice(0, -2); // Remove ".*"
        if (requiredPerm.startsWith(prefix + '.')) {
          return true;
        }
      }

      // Universal wildcard
      if (perm === '*') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if API pattern matches the endpoint
   */
  private static patternMatches(pattern: string, endpoint: string): boolean {
    // Simple pattern matching for :paramName
    const patternParts = pattern.split('/');
    const endpointParts = endpoint.split('/');

    if (patternParts.length !== endpointParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const endpointPart = endpointParts[i];

      // Parameter match (starts with :)
      if (patternPart.startsWith(':')) {
        continue;
      }

      // Exact match required
      if (patternPart !== endpointPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute an API call with permission checking
   */
  static async executeAPICall(
    pluginId: string,
    method: string,
    endpoint: string,
    data?: unknown
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Load plugin to get permissions
      const plugin = await db.plugin.findUnique({ where: { pluginId } });

      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      // Check permission
      if (!this.checkPermission(method, endpoint, plugin.permissions)) {
        throw new Error(
          `Plugin ${pluginId} lacks permission for ${method} ${endpoint}`
        );
      }

      // In a real implementation, execute the API call here
      // For now, return a mock response
      console.log(`[PluginAPIProxy] Allowing ${method} ${endpoint} for plugin ${pluginId}`);

      return {
        success: true,
        message: `API call executed: ${method} ${endpoint}`,
      };
    } catch (error) {
      console.error('[PluginAPIProxy] API call error:', error);
      throw error;
    }
  }
}
