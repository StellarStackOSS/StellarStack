# StellarStack Plugin Examples

Welcome to the StellarStack Plugin Development Examples! These examples demonstrate how to build plugins using the declarative UI schema system.

## 🚀 Quick Start

1. **Choose an example** that matches your use case
2. **Copy the example directory** to your plugins folder or GitHub
3. **Customize `stellarstack.json`** for your needs
4. **Install** in StellarStack admin panel

## 📚 Examples

### 1. Example: Simple Form (`example-simple-form`)

A basic form UI for server settings configuration.

**What it demonstrates:**
- Form schema with different field types
- Text, number, boolean, select, and textarea inputs
- Load and submit actions
- Form validation

**Best for:**
- Server settings and configuration
- Simple data collection
- Admin panels

**Key Files:**
- `stellarstack.json` - Complete manifest with form schema

**View it:**
```bash
cat example-simple-form/stellarstack.json
```

---

### 2. Example: Search & Install (`example-search-install`)

A complete mod/plugin browser with search and install functionality.

**What it demonstrates:**
- Search and install UI schema
- Dynamic result cards with images and metadata
- Detail modal with additional information
- Installation workflow

**Best for:**
- Mod/plugin installers
- Content browsers
- Community content managers

**Key Files:**
- `stellarstack.json` - Search and install schema
- Action definitions for search, detail, install

**View it:**
```bash
cat example-search-install/stellarstack.json
```

---

### 3. Example: Stats Dashboard (`example-stats-dashboard`)

A server metrics and statistics display dashboard.

**What it demonstrates:**
- Stats schema for displaying metrics
- Multiple metric types (number, percentage, duration)
- Trend indicators (up/down/neutral)
- Automatic refresh capability

**Best for:**
- Server monitoring
- Performance dashboards
- Real-time metrics
- Analytics displays

**Key Files:**
- `stellarstack.json` - Stats schema with 8 different metrics

**View it:**
```bash
cat example-stats-dashboard/stellarstack.json
```

---

### 4. Example: Data Table (`example-data-table`)

A player management UI with searchable table and row actions.

**What it demonstrates:**
- Data table schema for lists
- Sortable columns
- Pagination support
- Row-level actions (kick, ban, teleport)
- Dangerous action confirmation

**Best for:**
- Player management
- Admin tools
- Data management interfaces
- Listing with actions

**Key Files:**
- `stellarstack.json` - Data table schema with actions

**View it:**
```bash
cat example-data-table/stellarstack.json
```

---

## 🛠️ How to Customize

Each example can be customized by editing `stellarstack.json`:

### Change Plugin Identity

```json
{
  "pluginId": "my-custom-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "My custom description",
  "author": "Your Name"
}
```

### Change Permissions

```json
{
  "permissions": ["files.read", "console.send"]
}
```

### Modify UI Schema

```json
{
  "ui": {
    "serverTabs": [
      {
        "uiSchema": {
          "type": "form",
          "fields": [
            // Customize fields here
          ]
        }
      }
    ]
  }
}
```

### Add Actions

```json
{
  "actions": [
    {
      "id": "my-action",
      "operations": [
        {
          "type": "send-command",
          "command": "say Hello world"
        }
      ]
    }
  ]
}
```

## 📋 Manifest File Format

Every plugin must have a `stellarstack.json` file:

```json
{
  "pluginId": "unique-plugin-id",
  "name": "Plugin Display Name",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Your Name",
  "license": "MIT",
  "category": "category-name",
  "gameTypes": ["minecraft", "rust", "*"],
  "permissions": ["files.read"],
  "ui": {
    "serverTabs": [{...}],
    "adminPages": [{...}],
    "serverWidgets": [{...}]
  },
  "actions": [{...}],
  "configSchema": {...},
  "defaultConfig": {...}
}
```

## 🎨 UI Schema Types

Choose the right schema for your use case:

| Schema | Use Case | Example |
|--------|----------|---------|
| `form` | Settings, configuration | Server settings, player prefs |
| `search-and-install` | Browse and install content | Mod installers, content browsers |
| `data-table` | Lists with actions | Player management, inventory |
| `stats` | Metrics and KPIs | Dashboard, monitoring |
| `action-button` | Single action | Restart server, force save |
| `compound` | Multi-section layout | Complex dashboards |

## 🔑 Key Concepts

### Actions

Actions define what happens when users interact with the UI:

```json
{
  "id": "save-settings",
  "operations": [
    {
      "type": "send-command",
      "command": "say Settings updated"
    }
  ]
}
```

### Operations

Operations are the actual tasks performed:
- `send-command` - Run console command
- `download-to-server` - Download file
- `write-file` - Create/update file
- `delete-file` - Remove file
- `restart-server` - Restart server
- `start-server` / `stop-server` - Server control
- `create-backup` - Backup server

### Template Variables

Use `{{variable}}` in commands:

```json
{
  "type": "send-command",
  "command": "say Player {{playerName}} joined!"
}
```

### Permissions

Declare what the plugin needs:

```json
{
  "permissions": [
    "files.read",           // Read files
    "files.write",          // Write files
    "console.send",         // Run commands
    "control.restart",      // Restart server
    "activity.read"         // Read logs
  ]
}
```

## 📖 Documentation

For detailed information, see:

- **PLUGIN_DEVELOPMENT_GUIDE.md** - Complete development guide
- **UI Schema Reference** - Detailed schema documentation
- **API Documentation** - Plugin API reference

## 🔍 Finding What You Need

### I want to build a...

- **Settings panel** → Use `example-simple-form`
- **Mod browser** → Use `example-search-install`
- **Server dashboard** → Use `example-stats-dashboard`
- **Admin tool** → Use `example-data-table`

### I want to learn about...

- **Form fields** → See `example-simple-form`
- **Search workflows** → See `example-search-install`
- **Metrics display** → See `example-stats-dashboard`
- **Table actions** → See `example-data-table`
- **General concepts** → Read `PLUGIN_DEVELOPMENT_GUIDE.md`

## 🚀 Publishing Your Plugin

1. **Create a GitHub repository** for your plugin
2. **Add your customized `stellarstack.json`** and any supporting files
3. **Submit to plugin registry** - Coming soon!
4. **Get listed in marketplace** for all users to discover

## ⚠️ Important Notes

- All example plugins are **action-based** - no custom code needed
- They rely on **declarative UI schemas** for frontend rendering
- Actions are executed on the **StellarStack API** with permission checks
- Operations are **sequential** and atomic

## 🤝 Contributing

Found an issue or have an improvement?

1. Fork the [StellarStack-Plugin-SDK repository](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK)
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

All examples are released under the **MIT License**. Feel free to use them as a starting point for your own plugins!

## 🆘 Support

- **Questions?** Check the [Plugin Development Guide](PLUGIN_DEVELOPMENT_GUIDE.md)
- **Found a bug?** Open an [issue on GitHub](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/issues)
- **Need help?** Join our [Discord community](https://discord.gg/stellarstack)

---

**Happy plugin development! 🎉**

Start with any example that matches your needs, customize it, and share with the community!
