# StellarStack Plugin Development Guide

## Overview

The StellarStack plugin system uses **declarative UI schemas** to define plugin interfaces. This allows you to build powerful plugins without writing React components or complex frontend code.

## Quick Start

### 1. Plugin Structure

```
my-plugin/
├── package.json          # npm metadata
├── stellarstack.json     # Plugin manifest (required)
├── actions/              # Optional: Custom action implementations
│   └── custom.js
└── README.md             # Documentation
```

### 2. Minimum Plugin Configuration

Create `stellarstack.json`:

```json
{
  "pluginId": "my-custom-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Does something amazing",
  "author": "Your Name",
  "license": "MIT",
  "category": "utility",
  "gameTypes": ["*"],
  "permissions": ["files.read"],
  "defaultConfig": {}
}
```

### 3. Add a Server Tab with UI

```json
{
  "pluginId": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "...": "...",
  "ui": {
    "serverTabs": [
      {
        "id": "main",
        "label": "My Tab",
        "icon": "box",
        "uiSchema": {
          "type": "form",
          "title": "Settings",
          "fields": [
            {
              "id": "name",
              "label": "Your Name",
              "type": "string",
              "required": true
            }
          ],
          "submitAction": "save-settings",
          "submitLabel": "Save"
        }
      }
    ]
  },
  "actions": [
    {
      "id": "save-settings",
      "label": "Save Settings",
      "operations": [
        {
          "type": "send-command",
          "command": "say Settings saved: {{name}}"
        }
      ]
    }
  ]
}
```

## UI Schema Types

### 1. Form Schema

Perfect for settings, configuration, and data collection.

**Properties:**
- `type`: "form"
- `title`: Form title
- `description`: Form description
- `fields`: Array of field schemas
- `submitAction`: Action ID to call on submit
- `loadAction`: Action ID to load form data (optional)
- `submitLabel`: Button text (default: "Submit")
- `successMessage`: Message shown on success

**Field Types:**
- `string`: Text input
- `number`: Number input
- `boolean`: Checkbox
- `select`: Dropdown
- `textarea`: Multi-line text
- `password`: Password input

**Example:**

```json
{
  "type": "form",
  "title": "Server Configuration",
  "fields": [
    {
      "id": "serverName",
      "label": "Server Name",
      "type": "string",
      "required": true,
      "placeholder": "Enter name"
    },
    {
      "id": "difficulty",
      "label": "Difficulty",
      "type": "select",
      "options": [
        { "label": "Easy", "value": "easy" },
        { "label": "Hard", "value": "hard" }
      ]
    }
  ],
  "submitAction": "save-config"
}
```

### 2. Search and Install Schema

Perfect for browsing and installing mods, plugins, or content.

**Properties:**
- `type`: "search-and-install"
- `searchAction`: Action to search items
- `detailAction`: Action to get item details
- `installAction`: Action to install item
- `fields`: UI field definitions

**Field Definitions:**
- `searchInput`: Search box configuration
- `resultCard`: How to display search results
- `installModal`: Install confirmation dialog (optional)

**Example:**

```json
{
  "type": "search-and-install",
  "searchAction": "search-mods",
  "detailAction": "get-mod-details",
  "installAction": "install-mod",
  "fields": {
    "searchInput": {
      "placeholder": "Search mods..."
    },
    "resultCard": {
      "title": "modName",
      "subtitle": "author",
      "image": "imageUrl",
      "description": "summary",
      "metadata": [
        {
          "label": "Downloads",
          "field": "downloadCount",
          "format": "number"
        }
      ]
    }
  }
}
```

### 3. Data Table Schema

Perfect for displaying lists of items with actions.

**Properties:**
- `type`: "data-table"
- `title`: Table title
- `loadAction`: Action to load data
- `columns`: Column definitions
- `pagination`: Pagination config
- `actions`: Row actions

**Example:**

```json
{
  "type": "data-table",
  "title": "Players",
  "loadAction": "fetch-players",
  "columns": [
    {
      "id": "username",
      "label": "Name",
      "format": "text",
      "sortable": true
    }
  ],
  "actions": [
    {
      "id": "kick",
      "label": "Kick",
      "actionId": "kick-player"
    }
  ]
}
```

### 4. Stats Schema

Perfect for displaying metrics and KPIs.

**Properties:**
- `type`: "stats"
- `loadAction`: Action to fetch stats
- `items`: Stat definitions

**Item Properties:**
- `id`: Stat identifier
- `label`: Display label
- `icon`: Icon name
- `format`: "number", "percentage", "duration", "text"
- `trend`: "up", "down", "neutral" (optional)

**Example:**

```json
{
  "type": "stats",
  "loadAction": "fetch-stats",
  "items": [
    {
      "id": "playerCount",
      "label": "Players Online",
      "format": "number",
      "trend": "up"
    },
    {
      "id": "cpuUsage",
      "label": "CPU",
      "format": "percentage"
    }
  ]
}
```

### 5. Action Button Schema

Perfect for single-click actions.

**Properties:**
- `type`: "action-button"
- `label`: Button text
- `actionId`: Action to trigger
- `icon`: Icon name (optional)
- `variant`: "primary", "secondary", "danger"
- `dangerous`: Requires confirmation
- `confirmation`: Confirmation message

**Example:**

```json
{
  "type": "action-button",
  "label": "Restart Server",
  "actionId": "restart-server",
  "icon": "refresh",
  "variant": "danger",
  "dangerous": true,
  "confirmation": "Restart the server?"
}
```

### 6. Compound Schema

Combines multiple schemas into sections.

**Properties:**
- `type`: "compound"
- `layout`: "vertical", "horizontal", "grid"
- `sections`: Array of sections with schema

**Example:**

```json
{
  "type": "compound",
  "layout": "grid",
  "sections": [
    {
      "title": "Stats",
      "schema": { "type": "stats", "..." }
    },
    {
      "title": "Settings",
      "schema": { "type": "form", "..." }
    }
  ]
}
```

## Actions and Operations

Actions define what happens when users interact with your plugin UI.

### Action Definition

```json
{
  "id": "my-action",
  "label": "My Action",
  "description": "What this action does",
  "dangerous": false,
  "params": [
    {
      "id": "paramName",
      "label": "Parameter Label",
      "type": "string",
      "required": true
    }
  ],
  "operations": [
    {
      "type": "send-command",
      "command": "say Hello {{paramName}}"
    }
  ]
}
```

### Supported Operations

**send-command**
- Sends a console command to the server
- Supports template variables: `{{paramName}}`, `{{config.keyName}}`

```json
{
  "type": "send-command",
  "command": "say Welcome {{playerName}}"
}
```

**download-to-server**
- Downloads a file and saves it on the server

```json
{
  "type": "download-to-server",
  "url": "https://example.com/file.zip",
  "destPath": "/server/mods/file.zip",
  "headers": { "Authorization": "Bearer token" }
}
```

**write-file**
- Writes content to a file on the server

```json
{
  "type": "write-file",
  "path": "/server/config.json",
  "content": "{ \"key\": \"value\" }"
}
```

**delete-file**
- Deletes a file from the server

```json
{
  "type": "delete-file",
  "path": "/server/old-file.txt"
}
```

**restart-server**
- Restarts the game server

```json
{
  "type": "restart-server"
}
```

**stop-server**, **start-server**
- Stops or starts the server

**create-backup**
- Creates a server backup

## Template Variables

In action commands and URLs, you can use template variables:

- `{{paramName}}` - Action parameter values
- `{{config.keyName}}` - Plugin configuration values
- `{{username}}` - Current user (if available)

Example:

```json
{
  "type": "send-command",
  "command": "say Thanks {{username}} for using {{config.pluginName}}"
}
```

## Permissions

Declare what the plugin is allowed to do:

```json
{
  "permissions": [
    "files.read",      // Read files
    "files.write",     // Write files
    "files.*",         // All file operations
    "console.send",    // Send commands
    "control.start",   // Start server
    "control.stop",    // Stop server
    "control.*",       // All control operations
    "activity.read",   // Read activity logs
    "backups.create"   // Create backups
  ]
}
```

## Configuration Schema

Plugins can have user-configurable settings:

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "Your API key",
        "sensitive": true  // Encrypted at rest
      },
      "autoRestart": {
        "type": "boolean",
        "title": "Auto-restart",
        "default": true
      }
    },
    "required": ["apiKey"]
  },
  "defaultConfig": {
    "apiKey": "",
    "autoRestart": true
  }
}
```

## Example Plugins

See the `examples/` directory for complete working examples:

- `example-simple-form` - Form-based settings
- `example-search-install` - Mod browser and installer
- `example-stats-dashboard` - Statistics display
- `example-data-table` - Player management

## Installation

To install a plugin from a Git repository:

1. Go to admin panel → Plugins → Marketplace
2. Click "Install from Git Repository"
3. Paste the repository URL: `https://gitlab.com/username/my-plugin`
4. Click Install

The plugin will be:
- Downloaded and extracted
- Analyzed for security
- Registered in the system
- Ready to enable

## Publishing Your Plugin

To share your plugin with the community:

1. Create a public Git repository
2. Add `stellarstack.json` with complete metadata
3. Submit to the StellarStack plugin registry
4. Get listed in the marketplace!

## Best Practices

1. **Be Declarative** - Use schemas instead of code
2. **Ask for Permissions** - Only request what you need
3. **Handle Errors Gracefully** - Show helpful messages
4. **Test Thoroughly** - Test with different servers
5. **Document Well** - Explain what your plugin does
6. **Keep It Simple** - Start small, add features later
7. **Use Template Variables** - Make configs dynamic

## Troubleshooting

**Plugin not showing up:**
- Check that `stellarstack.json` is valid JSON
- Verify `pluginId` is unique
- Ensure required fields are present

**Actions not executing:**
- Check action `id` matches in UI schema
- Verify operations are syntactically correct
- Check permissions are declared

**Security analysis warning:**
- Review operation commands for anything risky
- Ensure no hardcoded secrets in manifest
- Use `{{config.keyName}}` for secrets instead

## Support

- **Documentation**: https://docs.stellar stack.dev/plugins
- **GitLab Issues**: https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK/-/issues
- **Community Forum**: https://community.stellarstack.dev
- **Discord**: https://discord.gg/stellarstack
