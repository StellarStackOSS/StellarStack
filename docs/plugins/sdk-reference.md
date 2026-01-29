# Plugin SDK Reference

Complete API reference for the `@stellarstack/plugin-sdk` package.

## Core Classes

### StellarPlugin (Abstract)

The base class all plugins must extend.

```typescript
abstract class StellarPlugin {
  abstract readonly manifest: PluginManifest;
  abstract onEnable(context: PluginContext): Promise<void>;
  abstract onDisable(context: PluginContext): Promise<void>;
  getRoutes?(): PluginRoute[];
  onConfigUpdate?(context: PluginContext, oldConfig, newConfig): Promise<void>;
  validateConfig?(config: Record<string, unknown>): string | null;
}
```

### PluginContext

Provided to plugins during lifecycle events. Your gateway to StellarStack APIs.

```typescript
class PluginContext {
  manifest: PluginManifest; // Plugin manifest
  pluginId: string; // Shorthand for manifest.id
  api: PluginAPI; // Access to StellarStack APIs
  config: Record<string, unknown>; // Current plugin configuration

  // Register a hook handler
  on(event: PluginHookEvent, handler: HookHandler, priority?: HookPriority): void;

  // Register a filter
  addFilter(name: string, filter: HookFilter, priority?: HookPriority): void;

  // Scoped logger
  log: { info; warn; error; debug };
}
```

### HookRegistry

Manages hook subscriptions across all plugins.

```typescript
class HookRegistry {
  on(event, pluginId, handler, priority?): void;
  removePlugin(pluginId): void;
  emit(event, context): Promise<void>;
  addFilter(name, pluginId, filter, priority?): void;
  applyFilters<T>(name, value, context): Promise<T>;
  getRegisteredHooks(): Record<string, string[]>;
  hasHooks(event): boolean;
}
```

## Type Definitions

### PluginManifest

```typescript
interface PluginManifest {
  id: string; // Unique ID (lowercase, alphanumeric, hyphens)
  name: string; // Display name (max 64 chars)
  version: string; // Semver version
  description: string; // Short description (max 256 chars)
  author: string; // Author name
  license?: string; // License (default: "MIT")
  homepage?: string; // Homepage URL
  repository?: string; // Repository URL
  icon?: string; // Icon identifier or path
  minVersion?: string; // Minimum StellarStack version
  category?: PluginCategory;
  gameTypes?: string[]; // Game type support (default: ["*"])
  permissions?: string[]; // Required StellarStack permissions
  hooks?: string[]; // Hook events to subscribe to

  ui?: {
    serverTabs?: ServerTabDefinition[];
    adminPages?: AdminPageDefinition[];
    serverWidgets?: ServerWidgetDefinition[];
    settingsPanel?: string;
  };

  configSchema?: object; // JSON Schema for configuration
  defaultConfig?: Record<string, unknown>;
}
```

### PluginAPI

The API object provided through `context.api`.

```typescript
interface PluginAPI {
  servers: {
    get(serverId): Promise<ServerInfo>;
    list(): Promise<ServerInfo[]>;
    sendCommand(serverId, command): Promise<void>;
    getStatus(serverId): Promise<string>;
  };

  files: {
    list(serverId, path?): Promise<FileInfo[]>;
    read(serverId, path): Promise<string>;
    write(serverId, path, content): Promise<void>;
    create(serverId, path, type, content?): Promise<void>;
    delete(serverId, path): Promise<void>;
    downloadUrl(serverId, url, destPath): Promise<void>;
  };

  storage: {
    get<T>(key): Promise<T | null>;
    set<T>(key, value): Promise<void>;
    delete(key): Promise<void>;
    keys(): Promise<string[]>;
  };

  http: {
    get<T>(url, headers?): Promise<T>;
    post<T>(url, body?, headers?): Promise<T>;
    put<T>(url, body?, headers?): Promise<T>;
    delete<T>(url, headers?): Promise<T>;
  };

  log: { info; warn; error; debug };

  notify: {
    toast(serverId, message, type?): void;
  };
}
```

### Hook Events

All available hook events:

| Event                           | Description          | Context Data                         |
| ------------------------------- | -------------------- | ------------------------------------ |
| `server:beforeStart`            | Before server starts | `{ serverId }`                       |
| `server:afterStart`             | After server starts  | `{ serverId }`                       |
| `server:beforeStop`             | Before server stops  | `{ serverId }`                       |
| `server:afterStop`              | After server stops   | `{ serverId }`                       |
| `server:beforeRestart`          | Before restart       | `{ serverId }`                       |
| `server:afterRestart`           | After restart        | `{ serverId }`                       |
| `server:beforeInstall`          | Before install       | `{ serverId, blueprintId }`          |
| `server:afterInstall`           | After install        | `{ serverId, success }`              |
| `server:statusChange`           | Status changed       | `{ serverId, oldStatus, newStatus }` |
| `server:created`                | Server created       | `{ serverId, name }`                 |
| `server:deleted`                | Server deleted       | `{ serverId }`                       |
| `server:console`                | Console output       | `{ serverId, line }`                 |
| `server:file:beforeWrite`       | Before file write    | `{ serverId, path }`                 |
| `server:file:afterWrite`        | After file write     | `{ serverId, path }`                 |
| `server:file:beforeDelete`      | Before file delete   | `{ serverId, path }`                 |
| `server:file:afterDelete`       | After file delete    | `{ serverId, path }`                 |
| `server:backup:beforeCreate`    | Before backup        | `{ serverId }`                       |
| `server:backup:afterCreate`     | After backup         | `{ serverId, backupId }`             |
| `server:backup:beforeRestore`   | Before restore       | `{ serverId, backupId }`             |
| `server:backup:afterRestore`    | After restore        | `{ serverId, backupId }`             |
| `server:schedule:beforeExecute` | Before schedule run  | `{ serverId, scheduleId }`           |
| `server:schedule:afterExecute`  | After schedule run   | `{ serverId, scheduleId }`           |
| `user:login`                    | User logged in       | `{ userId }`                         |
| `user:created`                  | User created         | `{ userId }`                         |
| `plugin:enabled`                | Plugin enabled       | `{ pluginId }`                       |
| `plugin:disabled`               | Plugin disabled      | `{ pluginId }`                       |
| `plugin:configUpdated`          | Config changed       | `{ pluginId, oldConfig, newConfig }` |

### Hook Priority

```typescript
type HookPriority = "low" | "normal" | "high" | "critical";
```

Hooks execute in priority order: `critical` > `high` > `normal` > `low`.

### UI Component Props

```typescript
// Props for server tab components
interface ServerTabProps {
  serverId: string;
  server: ServerInfo;
  pluginConfig: Record<string, unknown>;
}

// Props for server widget components
interface ServerWidgetProps {
  serverId: string;
  server: ServerInfo;
  pluginConfig: Record<string, unknown>;
}

// Props for admin page components
interface AdminPageProps {
  pluginConfig: Record<string, unknown>;
}

// Props for settings panel components
interface SettingsPanelProps {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}
```

## API Routes

Plugin management is available through the REST API:

| Method   | Path                                  | Auth  | Description              |
| -------- | ------------------------------------- | ----- | ------------------------ |
| `GET`    | `/api/plugins`                        | User  | List all plugins         |
| `GET`    | `/api/plugins/:pluginId`              | User  | Get plugin details       |
| `POST`   | `/api/plugins/:pluginId/enable`       | Admin | Enable a plugin          |
| `POST`   | `/api/plugins/:pluginId/disable`      | Admin | Disable a plugin         |
| `PATCH`  | `/api/plugins/:pluginId/config`       | Admin | Update configuration     |
| `DELETE` | `/api/plugins/:pluginId`              | Admin | Uninstall (non-built-in) |
| `GET`    | `/api/plugins/server/:serverId/tabs`  | User  | Get server tab plugins   |
| `GET`    | `/api/plugins/:pluginId/storage/:key` | User  | Get storage value        |
| `PUT`    | `/api/plugins/:pluginId/storage/:key` | User  | Set storage value        |

## Database Schema

Plugins are stored in two tables:

### `plugins` Table

| Column         | Type    | Description                            |
| -------------- | ------- | -------------------------------------- |
| `id`           | String  | Internal ID (cuid)                     |
| `pluginId`     | String  | Unique plugin identifier               |
| `name`         | String  | Display name                           |
| `version`      | String  | Semver version                         |
| `description`  | String? | Description                            |
| `author`       | String? | Author                                 |
| `status`       | String  | installed / enabled / disabled / error |
| `isBuiltIn`    | Boolean | Whether official plugin                |
| `config`       | Json    | User configuration                     |
| `manifest`     | Json    | Full manifest                          |
| `configSchema` | Json?   | JSON Schema                            |
| `uiMetadata`   | Json?   | UI extension points                    |

### `plugin_storage` Table

| Column     | Type    | Description           |
| ---------- | ------- | --------------------- |
| `id`       | String  | Internal ID           |
| `pluginId` | String  | Plugin reference      |
| `key`      | String  | Storage key           |
| `value`    | Json    | Stored value          |
| `serverId` | String? | Optional server scope |
