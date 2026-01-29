# StellarStack Plugin System - Getting Started

The StellarStack Plugin System allows you to extend the panel with custom functionality, from modpack installers to monitoring tools and game integrations.

## Architecture Overview

The plugin system has three layers:

```
┌─────────────────────────────────────────────┐
│              Plugin SDK Package              │
│   @stellarstack/plugin-sdk (TypeScript)      │
│   Types, base classes, hooks, context        │
├─────────────────────────────────────────────┤
│              API Plugin Manager              │
│   Plugin lifecycle, hooks, routes, storage   │
│   Database-backed state & configuration      │
├─────────────────────────────────────────────┤
│              Web UI Extensions               │
│   Server tabs, admin pages, widgets          │
│   Settings panels, plugin marketplace        │
└─────────────────────────────────────────────┘
```

### How It Works

1. **Plugin Manifest**: Every plugin declares its capabilities in a `stellar-plugin.json` manifest file
2. **API Manager**: The `PluginManager` loads, enables, and disables plugins. It manages their lifecycle, configuration, and hook subscriptions
3. **Hook System**: Plugins subscribe to events (server start, file write, etc.) and react to them
4. **UI Extensions**: Plugins can add tabs to server pages, pages to the admin panel, and widgets to dashboards
5. **Plugin Storage**: Each plugin gets its own key-value storage, optionally scoped per-server

## Quick Start

### 1. Install the SDK

```bash
npm install @stellarstack/plugin-sdk
```

### 2. Create Your Plugin

```typescript
import { StellarPlugin, PluginContext, PluginManifest } from "@stellarstack/plugin-sdk";

export default class MyPlugin extends StellarPlugin {
  readonly manifest: PluginManifest = {
    id: "my-awesome-plugin",
    name: "My Awesome Plugin",
    version: "1.0.0",
    description: "Does something amazing",
    author: "Your Name",
    license: "MIT",
    category: "utility",
    gameTypes: ["*"], // Supports all games
  };

  async onEnable(context: PluginContext): Promise<void> {
    context.log.info("Plugin enabled!");

    // Subscribe to server events
    context.on("server:afterStart", async (ctx) => {
      context.log.info(`Server ${ctx.serverId} started!`);
    });
  }

  async onDisable(context: PluginContext): Promise<void> {
    context.log.info("Plugin disabled!");
    // Hooks are automatically unregistered
  }
}
```

### 3. Define Your Manifest

Create a `stellar-plugin.json` file:

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does something amazing",
  "author": "Your Name",
  "license": "MIT",
  "category": "utility",
  "gameTypes": ["*"],
  "permissions": ["console.send"],
  "ui": {
    "serverTabs": [
      {
        "id": "my-tab",
        "label": "My Tab",
        "icon": "box",
        "component": "MyTabComponent"
      }
    ]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "Your API key for the external service"
      },
      "enabled": {
        "type": "boolean",
        "title": "Feature Enabled",
        "default": true
      }
    }
  },
  "defaultConfig": {
    "apiKey": "",
    "enabled": true
  }
}
```

## Plugin Categories

| Category          | Description              | Example                        |
| ----------------- | ------------------------ | ------------------------------ |
| `game-management` | Server management tools  | Auto-restart, version manager  |
| `modding`         | Mod/modpack management   | CurseForge installer, Modrinth |
| `monitoring`      | Analytics and monitoring | Player analytics, performance  |
| `automation`      | Automated tasks          | Server announcer, auto-backup  |
| `integration`     | External integrations    | Discord bot, webhook handler   |
| `security`        | Security features        | DDoS protection, firewall      |
| `utility`         | General utilities        | File manager, config editor    |
| `theme`           | UI themes                | Dark theme, custom branding    |
| `other`           | Uncategorized            | Everything else                |

## Game Type Targeting

Plugins can target specific game types using the `gameTypes` field:

- `"*"` - Supports all games (default)
- `"minecraft"` - Minecraft servers only
- `"rust"` - Rust servers only
- `["minecraft", "valheim"]` - Multiple specific games

Game types are matched against the server's blueprint category.

## Built-in Plugins

StellarStack ships with several official plugins:

| Plugin               | Category   | Game Types       | Description                            |
| -------------------- | ---------- | ---------------- | -------------------------------------- |
| CurseForge Installer | Modding    | Minecraft        | Browse and install CurseForge modpacks |
| Modrinth Manager     | Modding    | Minecraft        | Install mods from Modrinth             |
| Steam Workshop       | Modding    | Rust, GMod, etc. | Manage Steam Workshop items            |
| Server Announcer     | Automation | All              | Schedule server announcements          |
| Player Analytics     | Monitoring | All              | Track player activity                  |

## Next Steps

- [Plugin SDK Reference](./sdk-reference.md) - Full API documentation
- [Creating Plugins](./creating-plugins.md) - Step-by-step guide
- [Hooks Reference](./hooks-reference.md) - All available hook events
