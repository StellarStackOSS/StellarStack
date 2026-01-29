/**
 * StellarStack Plugin SDK - Hook System
 *
 * Provides the hook registry that plugins use to subscribe to events.
 * Hooks follow a WordPress-inspired action/filter pattern.
 */

import type { PluginHookEvent, HookHandler, HookFilter, HookContext } from "./types";

/** Priority levels for hook handlers */
export type HookPriority = "low" | "normal" | "high" | "critical";

const PRIORITY_ORDER: Record<HookPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

interface RegisteredHook {
  pluginId: string;
  handler: HookHandler;
  priority: HookPriority;
}

interface RegisteredFilter {
  pluginId: string;
  filter: HookFilter;
  priority: HookPriority;
}

/**
 * HookRegistry manages all plugin hook subscriptions.
 * It is created by the PluginManager and shared across all plugins.
 */
export class HookRegistry {
  private hooks: Map<PluginHookEvent, RegisteredHook[]> = new Map();
  private filters: Map<string, RegisteredFilter[]> = new Map();

  /**
   * Register an action hook handler.
   * Actions are fire-and-forget - they don't return values.
   */
  on(
    event: PluginHookEvent,
    pluginId: string,
    handler: HookHandler,
    priority: HookPriority = "normal"
  ): void {
    const existing = this.hooks.get(event) || [];
    existing.push({ pluginId, handler, priority });
    // Sort by priority
    existing.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    this.hooks.set(event, existing);
  }

  /**
   * Unregister all hooks for a specific plugin.
   */
  removePlugin(pluginId: string): void {
    for (const [event, handlers] of this.hooks.entries()) {
      this.hooks.set(
        event,
        handlers.filter((h) => h.pluginId !== pluginId)
      );
    }
    for (const [name, filters] of this.filters.entries()) {
      this.filters.set(
        name,
        filters.filter((f) => f.pluginId !== pluginId)
      );
    }
  }

  /**
   * Register a filter hook.
   * Filters transform data as it passes through the hook chain.
   */
  addFilter(
    name: string,
    pluginId: string,
    filter: HookFilter,
    priority: HookPriority = "normal"
  ): void {
    const existing = this.filters.get(name) || [];
    existing.push({ pluginId, filter, priority });
    existing.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    this.filters.set(name, existing);
  }

  /**
   * Execute all action hooks for an event.
   * Errors in individual handlers are caught and logged, not propagated.
   */
  async emit(
    event: PluginHookEvent,
    context: Omit<HookContext, "event" | "timestamp">
  ): Promise<void> {
    const handlers = this.hooks.get(event);
    if (!handlers || handlers.length === 0) return;

    const fullContext: HookContext = {
      ...context,
      event,
      timestamp: new Date(),
    };

    for (const { pluginId, handler } of handlers) {
      try {
        await handler(fullContext);
      } catch (error) {
        console.error(`[Plugin:${pluginId}] Hook error on ${event}:`, error);
      }
    }
  }

  /**
   * Apply all filters for a given name.
   * Each filter receives the value from the previous filter.
   */
  async applyFilters<T>(
    name: string,
    value: T,
    context: Omit<HookContext, "event" | "timestamp">
  ): Promise<T> {
    const filters = this.filters.get(name);
    if (!filters || filters.length === 0) return value;

    const fullContext: HookContext = {
      ...context,
      event: "plugin:configUpdated", // Filters don't have a specific event
      timestamp: new Date(),
    };

    let result = value;
    for (const { pluginId, filter } of filters) {
      try {
        result = (await filter(result, fullContext)) as T;
      } catch (error) {
        console.error(`[Plugin:${pluginId}] Filter error on ${name}:`, error);
      }
    }
    return result;
  }

  /**
   * Get all registered hooks for debugging/inspection.
   */
  getRegisteredHooks(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [event, handlers] of this.hooks.entries()) {
      result[event] = handlers.map((h) => `${h.pluginId} (${h.priority})`);
    }
    return result;
  }

  /**
   * Check if any hooks are registered for an event.
   */
  hasHooks(event: PluginHookEvent): boolean {
    const handlers = this.hooks.get(event);
    return !!handlers && handlers.length > 0;
  }
}
