# Creating StellarStack Plugins

This guide walks you through creating a plugin from scratch.

## Prerequisites

- Node.js 20+
- TypeScript 5+
- Familiarity with the StellarStack Panel

## Project Structure

A typical plugin has this structure:

```
my-plugin/
├── stellar-plugin.json    # Plugin manifest
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Plugin entry point (StellarPlugin class)
│   └── ...                # Additional source files
└── ui/                    # Optional: React UI components
    ├── MyServerTab.tsx
    └── MySettingsPanel.tsx
```

## Step 1: Create the Manifest

The `stellar-plugin.json` file describes your plugin to StellarStack:

```json
{
  "id": "my-first-plugin",
  "name": "My First Plugin",
  "version": "1.0.0",
  "description": "A simple example plugin",
  "author": "Your Name",
  "license": "MIT",
  "category": "utility",
  "gameTypes": ["*"],
  "permissions": [],
  "ui": {
    "serverTabs": [
      {
        "id": "my-tab",
        "label": "My Feature",
        "icon": "box",
        "component": "MyServerTab"
      }
    ]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "greeting": {
        "type": "string",
        "title": "Greeting Message",
        "description": "Message to display when the plugin loads",
        "default": "Hello from my plugin!"
      }
    }
  },
  "defaultConfig": {
    "greeting": "Hello from my plugin!"
  }
}
```

## Step 2: Create the Plugin Class

```typescript
// src/index.ts
import { StellarPlugin, PluginContext } from "@stellarstack/plugin-sdk";
import manifest from "../stellar-plugin.json";

export default class MyFirstPlugin extends StellarPlugin {
  readonly manifest = manifest;

  async onEnable(context: PluginContext): Promise<void> {
    const greeting = context.config.greeting as string;
    context.log.info(greeting);

    // React to server events
    context.on("server:afterStart", async (ctx) => {
      context.log.info(`Server ${ctx.serverId} just started!`);

      // Send a command to the server
      await context.api.servers.sendCommand(ctx.serverId!, `say ${greeting}`);
    });

    // Track something in plugin storage
    await context.api.storage.set(
      "enableCount",
      ((await context.api.storage.get<number>("enableCount")) || 0) + 1
    );

    context.log.info("Plugin enabled successfully!");
  }

  async onDisable(context: PluginContext): Promise<void> {
    context.log.info("Plugin disabled. Goodbye!");
  }

  // Optional: validate config before it's saved
  validateConfig(config: Record<string, unknown>): string | null {
    if (typeof config.greeting !== "string" || config.greeting.length === 0) {
      return "Greeting message cannot be empty";
    }
    return null; // null = valid
  }
}
```

## Step 3: Add UI Components (Optional)

If your plugin provides server tabs, create React components:

```tsx
// ui/MyServerTab.tsx
import React from "react";
import type { ServerTabProps } from "@stellarstack/plugin-sdk";

export const MyServerTab: React.FC<ServerTabProps> = ({ serverId, server, pluginConfig }) => {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-zinc-200">{pluginConfig.greeting as string}</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Server: {server.name} ({server.status})
      </p>
      <p className="text-sm text-zinc-500">ID: {serverId}</p>
    </div>
  );
};
```

## Step 4: Add Custom API Routes (Optional)

Plugins can register their own API routes:

```typescript
import { PluginRoute } from "@stellarstack/plugin-sdk";

export default class MyPlugin extends StellarPlugin {
  // ...

  getRoutes(): PluginRoute[] {
    return [
      {
        method: "GET",
        path: "/stats",
        description: "Get plugin stats",
        requireAuth: true,
        handler: async (ctx) => {
          const enableCount = await this.storage.get("enableCount");
          return {
            status: 200,
            body: {
              enableCount,
              uptime: Date.now(),
            },
          };
        },
      },
      {
        method: "POST",
        path: "/action",
        description: "Perform a custom action",
        requireAuth: true,
        handler: async (ctx) => {
          const { serverId, command } = ctx.body as any;
          // Do something...
          return { status: 200, body: { success: true } };
        },
      },
    ];
  }
}
```

Routes are mounted at `/api/plugins/:pluginId/`. So the stats route above would be accessible at `/api/plugins/my-first-plugin/stats`.

## Step 5: Use Plugin Storage

Every plugin gets its own key-value storage, optionally scoped to a server:

```typescript
// Global storage (shared across all servers)
await context.api.storage.set("globalSetting", { foo: "bar" });
const setting = await context.api.storage.get<{ foo: string }>("globalSetting");

// Server-scoped storage (different value per server)
// Done through the API routes with serverId parameter
```

## Step 6: Hook Into Events

Subscribe to StellarStack events to react to things happening:

```typescript
async onEnable(context: PluginContext) {
  // Before server starts - modify startup
  context.on("server:beforeStart", async (ctx) => {
    context.log.info(`Preparing server ${ctx.serverId}...`);
  });

  // After install - configure the server
  context.on("server:afterInstall", async (ctx) => {
    if (ctx.data.success) {
      context.log.info(`Server ${ctx.serverId} installed, configuring...`);
      // Write config files, etc.
    }
  });

  // Console output - react to messages
  context.on("server:console", async (ctx) => {
    const line = ctx.data.line as string;
    if (line.includes("player joined")) {
      // Track player joins
    }
  });

  // Backup events
  context.on("server:backup:afterCreate", async (ctx) => {
    context.log.info(`Backup created for ${ctx.serverId}`);
  });
}
```

## Configuration Schema

Use JSON Schema to define your plugin's configuration UI:

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "External service API key"
      },
      "maxRetries": {
        "type": "number",
        "title": "Max Retries",
        "description": "Maximum retry attempts",
        "default": 3
      },
      "autoStart": {
        "type": "boolean",
        "title": "Auto Start",
        "description": "Start automatically when server starts",
        "default": true
      }
    },
    "required": ["apiKey"]
  }
}
```

The admin panel automatically renders a settings form based on this schema.

## Testing Your Plugin

1. Place your plugin in the `plugins/` directory
2. Restart the StellarStack API
3. Go to Admin > Plugins
4. Your plugin should appear in the list
5. Enable it and configure as needed

## Best Practices

1. **Handle errors gracefully** - Never let errors in hooks crash the system
2. **Use scoped logging** - Always use `context.log` instead of `console.log`
3. **Clean up on disable** - Release resources in `onDisable()`
4. **Validate configuration** - Implement `validateConfig()` for user input
5. **Scope storage** - Use server-scoped storage when data is per-server
6. **Respect permissions** - Only use the permissions you declare in the manifest
7. **Keep it lightweight** - Don't block the event loop with heavy operations
8. **Document your plugin** - Include a README with setup instructions
