/**
 * StellarStack Plugin SDK - Plugin Context
 *
 * The PluginContext is the primary interface plugins use to interact
 * with the StellarStack platform. It provides scoped access to the
 * plugin API, configuration, hooks, and storage.
 */

import type { PluginAPI, PluginManifest, PluginHookEvent, HookHandler, HookFilter } from "./types";
import type { HookPriority, HookRegistry } from "./hooks";

/**
 * PluginContext is provided to plugins during their lifecycle.
 * It provides safe, scoped access to StellarStack functionality.
 */
export class PluginContext {
  private _manifest: PluginManifest;
  private _api: PluginAPI;
  private _hookRegistry: HookRegistry;
  private _config: Record<string, unknown>;

  constructor(
    manifest: PluginManifest,
    api: PluginAPI,
    hookRegistry: HookRegistry,
    config: Record<string, unknown>
  ) {
    this._manifest = manifest;
    this._api = api;
    this._hookRegistry = hookRegistry;
    this._config = config;
  }

  /** Get the plugin manifest */
  get manifest(): PluginManifest {
    return this._manifest;
  }

  /** Get the plugin ID */
  get pluginId(): string {
    return this._manifest.id;
  }

  /** Get the plugin API */
  get api(): PluginAPI {
    return this._api;
  }

  /** Get the current plugin configuration */
  get config(): Record<string, unknown> {
    return { ...this._config };
  }

  /** Update the plugin configuration */
  updateConfig(updates: Record<string, unknown>): void {
    Object.assign(this._config, updates);
  }

  /**
   * Register an action hook handler.
   * Actions are executed when specific events occur in StellarStack.
   *
   * @example
   * ```ts
   * context.on("server:afterStart", async (ctx) => {
   *   console.log(`Server ${ctx.serverId} started!`);
   * });
   * ```
   */
  on(event: PluginHookEvent, handler: HookHandler, priority?: HookPriority): void {
    this._hookRegistry.on(event, this._manifest.id, handler, priority);
  }

  /**
   * Register a filter hook.
   * Filters can transform data as it passes through the system.
   *
   * @example
   * ```ts
   * context.addFilter("server:startup:command", async (command, ctx) => {
   *   return command + " --custom-flag";
   * });
   * ```
   */
  addFilter(name: string, filter: HookFilter, priority?: HookPriority): void {
    this._hookRegistry.addFilter(name, this._manifest.id, filter, priority);
  }

  /**
   * Scoped logger that prefixes messages with the plugin name.
   */
  get log() {
    const prefix = `[Plugin:${this._manifest.id}]`;
    return {
      info: (message: string, ...args: unknown[]) => console.log(`${prefix} ${message}`, ...args),
      warn: (message: string, ...args: unknown[]) => console.warn(`${prefix} ${message}`, ...args),
      error: (message: string, ...args: unknown[]) =>
        console.error(`${prefix} ${message}`, ...args),
      debug: (message: string, ...args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
          console.debug(`${prefix} ${message}`, ...args);
        }
      },
    };
  }
}
