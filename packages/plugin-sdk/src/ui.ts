/**
 * StellarStack Plugin SDK - UI Types
 *
 * Types and utilities for building plugin UI components.
 * These are used by plugin React components rendered in the web app.
 */

import type {
  ServerTabProps,
  ServerWidgetProps,
  AdminPageProps,
  SettingsPanelProps,
} from "./types";

/**
 * Registry of UI components provided by plugins.
 * Built-in plugins register their components here.
 * The web app uses this registry to render plugin UIs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentType<P = any> = (props: P) => any;

export interface PluginUIRegistry {
  /** Server tab components indexed by pluginId:tabId */
  serverTabs: Map<string, ComponentType<ServerTabProps>>;
  /** Server widget components indexed by pluginId:widgetId */
  serverWidgets: Map<string, ComponentType<ServerWidgetProps>>;
  /** Admin page components indexed by pluginId:pageId */
  adminPages: Map<string, ComponentType<AdminPageProps>>;
  /** Settings panel components indexed by pluginId */
  settingsPanels: Map<string, ComponentType<SettingsPanelProps>>;
}

/**
 * Create a new empty UI registry.
 */
export function createUIRegistry(): PluginUIRegistry {
  return {
    serverTabs: new Map(),
    serverWidgets: new Map(),
    adminPages: new Map(),
    settingsPanels: new Map(),
  };
}

/**
 * Plugin UI component metadata.
 * Used by the web app to render plugin UI extension points.
 */
export interface PluginUIMetadata {
  pluginId: string;
  pluginName: string;
  pluginIcon?: string;
  /** Server tabs this plugin provides */
  serverTabs: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
  /** Server widgets this plugin provides */
  serverWidgets: Array<{
    id: string;
    label: string;
    size: "small" | "medium" | "large";
  }>;
  /** Admin pages this plugin provides */
  adminPages: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
  /** Whether the plugin has a settings panel */
  hasSettingsPanel: boolean;
}

// Re-export UI prop types for convenience
export type { ServerTabProps, ServerWidgetProps, AdminPageProps, SettingsPanelProps };
