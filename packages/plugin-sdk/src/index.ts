/**
 * StellarStack Plugin SDK
 *
 * The official SDK for building StellarStack plugins and extensions.
 *
 * @example
 * ```ts
 * import { StellarPlugin, PluginContext } from "@stellarstack/plugin-sdk";
 *
 * export default class MyPlugin extends StellarPlugin {
 *   manifest = {
 *     id: "my-plugin",
 *     name: "My Plugin",
 *     version: "1.0.0",
 *     description: "Does cool stuff",
 *     author: "You",
 *     license: "MIT",
 *     category: "utility" as const,
 *   };
 *
 *   async onEnable(ctx: PluginContext) {
 *     ctx.log.info("Enabled!");
 *   }
 *
 *   async onDisable(ctx: PluginContext) {
 *     ctx.log.info("Disabled!");
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Core plugin class
export { StellarPlugin } from "./plugin";

// Context
export { PluginContext } from "./context";

// Hook system
export { HookRegistry } from "./hooks";
export type { HookPriority } from "./hooks";

// Types
export { PluginManifestSchema } from "./types";

export type {
  PluginManifest,
  PluginStatus,
  PluginState,
  PluginHookEvent,
  HookContext,
  HookHandler,
  HookFilter,
  PluginRoute,
  PluginRouteContext,
  PluginRouteHandler,
  PluginRouteResponse,
  PluginAPI,
  ServerInfo,
  FileInfo,
  HttpMethod,
  ServerTabProps,
  ServerWidgetProps,
  AdminPageProps,
  SettingsPanelProps,
} from "./types";

// UI
export { createUIRegistry } from "./ui";
export type { PluginUIRegistry, PluginUIMetadata } from "./ui";
