/**
 * StellarStack Plugin SDK - Base Plugin Class
 *
 * All StellarStack plugins must extend the StellarPlugin class.
 * This provides the lifecycle hooks and structure that the
 * PluginManager uses to manage plugins.
 */

import type { PluginManifest, PluginRoute } from "./types";
import type { PluginContext } from "./context";

/**
 * Abstract base class for all StellarStack plugins.
 *
 * @example
 * ```ts
 * import { StellarPlugin, PluginContext, PluginManifest } from "@stellarstack/plugin-sdk";
 *
 * export default class MyPlugin extends StellarPlugin {
 *   manifest: PluginManifest = {
 *     id: "my-plugin",
 *     name: "My Plugin",
 *     version: "1.0.0",
 *     description: "A sample plugin",
 *     author: "Your Name",
 *     license: "MIT",
 *     category: "utility",
 *   };
 *
 *   async onEnable(context: PluginContext): Promise<void> {
 *     context.log.info("Plugin enabled!");
 *     context.on("server:afterStart", async (ctx) => {
 *       context.log.info(`Server ${ctx.serverId} started`);
 *     });
 *   }
 *
 *   async onDisable(context: PluginContext): Promise<void> {
 *     context.log.info("Plugin disabled!");
 *   }
 * }
 * ```
 */
export abstract class StellarPlugin {
  /**
   * The plugin manifest.
   * This must be defined by every plugin implementation.
   */
  abstract readonly manifest: PluginManifest;

  /**
   * Called when the plugin is enabled.
   * Use this to register hooks, set up routes, and initialize resources.
   *
   * @param context - The plugin context providing access to StellarStack APIs
   */
  abstract onEnable(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is disabled.
   * Use this to clean up resources, remove handlers, etc.
   * Hook handlers are automatically unregistered.
   *
   * @param context - The plugin context
   */
  abstract onDisable(context: PluginContext): Promise<void>;

  /**
   * Optional: Register API routes for this plugin.
   * Routes are mounted at /api/plugins/:pluginId/
   *
   * @returns Array of route definitions
   */
  getRoutes?(): PluginRoute[];

  /**
   * Optional: Called when the plugin configuration is updated.
   *
   * @param context - The plugin context with the new configuration
   * @param oldConfig - The previous configuration
   * @param newConfig - The new configuration
   */
  onConfigUpdate?(
    context: PluginContext,
    oldConfig: Record<string, unknown>,
    newConfig: Record<string, unknown>
  ): Promise<void>;

  /**
   * Optional: Validate plugin configuration before it's applied.
   * Return an error message string if validation fails, or null if valid.
   *
   * @param config - The configuration to validate
   * @returns Error message or null
   */
  validateConfig?(config: Record<string, unknown>): string | null;
}
