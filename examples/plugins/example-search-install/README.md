# Search and Install Example Plugin

A reference implementation demonstrating the search-and-install UI schema pattern for StellarStack plugins. This plugin showcases how to build a discoverable content browser with installation capabilities.

## Overview

The Search and Install plugin provides:
- 🔍 **Full-text search interface** for discovering content
- ⚡ **One-click installation** with automatic downloads
- 📦 **Template variable support** for dynamic content URLs
- 🎮 **Server-scoped actions** with context awareness
- 🛡️ **Permission-based access control** for file operations

## Features

### Search and Install UI

The plugin implements a modern search-and-install interface with:

- **Real-time search input** with customizable placeholder text
- **Result grid display** showing matching content
- **Detail modal** for viewing full content information
- **Install button** for one-click content installation
- **Responsive design** that works on all screen sizes
- **Instant feedback** with loading states and error handling

### Declarative Actions

All functionality is defined using declarative action schemas:

```json
{
  "id": "install-content",
  "label": "Install Content",
  "description": "Install selected content to the server",
  "params": [
    { "id": "contentId", "type": "string", "required": true },
    { "id": "contentName", "type": "string", "required": true }
  ],
  "operations": [
    {
      "type": "download-to-server",
      "url": "https://example.com/content/{{contentId}}/download",
      "directory": "mods",
      "decompress": true
    },
    {
      "type": "send-command",
      "command": "say Installed {{contentName}}"
    }
  ]
}
```

## Installation

### From StellarStack Panel

1. Navigate to **Admin Panel** → **Extensions**
2. Click **Install from Git**
3. Enter the repository URL
4. Security analysis runs automatically
5. Extension appears in your plugins list

### From Git CLI

```bash
# Clone the repository
git clone https://gitlab.com/your-username/example-search-install.git
cd example-search-install

# Install in StellarStack plugins directory
# (This happens automatically via the panel)
```

## Configuration

The plugin requires no configuration by default, but you can customize:

### UI Schema Customization

Update `stellarstack.json` to customize the search interface:

```json
{
  "ui": {
    "serverTabs": [
      {
        "id": "search-install",
        "label": "Search & Install",
        "icon": "download",
        "uiSchema": {
          "type": "search-and-install",
          "searchPlaceholder": "Search for mods, maps, or plugins...",
          "searchEndpoint": "/api/plugins/example-search-install/search",
          "installAction": "install-content"
        }
      }
    ]
  }
}
```

### Search Endpoint

The `searchEndpoint` should return content in this format:

```json
{
  "results": [
    {
      "id": "mod-123",
      "name": "Example Mod",
      "description": "A cool mod that does something",
      "author": "Mod Author",
      "version": "1.0.0",
      "downloads": 15000,
      "updated": "2024-01-30T12:00:00Z",
      "image": "https://example.com/mod-123.png"
    }
  ]
}
```

## Supported Actions

### install-content

**Purpose:** Download and install content to a server

**Parameters:**
- `contentId` (string, required): Unique identifier for the content
- `contentName` (string, required): Display name of the content

**Operations:**
1. **download-to-server**: Fetch content from URL
   - `url`: Full download URL (supports `{{param}}` template variables)
   - `directory`: Destination directory on server (e.g., "mods", "plugins")
   - `decompress`: Auto-extract .zip files if true

2. **send-command**: Execute server console command
   - `command`: Console command (supports `{{param}}` template variables)
   - `timeout`: Optional command timeout in milliseconds

**Example Flow:**
1. User searches for content
2. User clicks install button
3. Content is downloaded to server
4. Archive is automatically extracted
5. Server broadcast message sent
6. User receives success notification

## Permissions

The plugin requires these permissions to function:

| Permission | Purpose |
|-----------|---------|
| `files.write` | Download and write content files to server |
| `console.send` | Send console messages to notify players |

**Permission Scoping:**
- Permissions are enforced at the action level
- API calls are validated before execution
- Unauthorized actions return 403 Forbidden

## Template Variables

The plugin supports dynamic parameter substitution:

```json
{
  "url": "https://example.com/content/{{contentId}}/download",
  "command": "say Installing {{contentName}} v{{version}}"
}
```

**Available Variables:**
- User-provided action parameters: `{{paramName}}`
- Plugin config values: `{{config.keyName}}` (if config schema exists)

## UI Schema Reference

### Search and Install Schema

Renders a modern search interface with:

```typescript
interface SearchAndInstallSchema {
  type: "search-and-install";
  searchPlaceholder?: string;        // Hint text in search box
  searchEndpoint: string;            // API endpoint to query
  installAction: string;             // Action ID to execute on install
}
```

**Features:**
- Real-time search filtering
- Result grid with cards
- Detail modal with full information
- Install button with confirmation
- Error handling and retry logic

## Advanced Usage

### Extending the Plugin

To create a similar plugin:

1. **Define your manifest** (`stellarstack.json`):
   ```json
   {
     "id": "your-plugin-id",
     "name": "Your Plugin",
     "ui": {
       "serverTabs": [
         {
           "uiSchema": {
             "type": "search-and-install",
             "searchEndpoint": "/api/plugins/your-plugin-id/search",
             "installAction": "install-item"
           }
         }
       ]
     },
     "actions": [ /* your actions */ ]
   }
   ```

2. **Implement your search endpoint**:
   ```typescript
   // Receives query parameter and returns matching results
   app.get("/api/plugins/your-plugin-id/search", async (c) => {
     const query = c.req.query("q");
     // Search your data source
     return c.json({ results: [...] });
   });
   ```

3. **Define installation actions** with operations

4. **Test locally** before distributing

### Multiple Search Actions

Create multiple search tabs for different content types:

```json
{
  "ui": {
    "serverTabs": [
      {
        "id": "mods",
        "label": "Mods",
        "uiSchema": {
          "type": "search-and-install",
          "searchEndpoint": "/api/plugins/example-search-install/search/mods",
          "installAction": "install-mod"
        }
      },
      {
        "id": "maps",
        "label": "Maps",
        "uiSchema": {
          "type": "search-and-install",
          "searchEndpoint": "/api/plugins/example-search-install/search/maps",
          "installAction": "install-map"
        }
      }
    ]
  }
}
```

### Conditional Operations

Use action parameters to conditionally execute operations:

```json
{
  "operations": [
    {
      "type": "download-to-server",
      "url": "https://example.com/{{type}}/{{contentId}}/download",
      "directory": "{{type}}",
      "decompress": true
    }
  ]
}
```

## Real-World Examples

### CurseForge Modpack Installer

The official CurseForge plugin uses the same pattern:

- Searches CurseForge API for modpacks
- Downloads selected modpack
- Extracts to server directory
- Auto-restarts server if configured
- Sends broadcast notification

### Modrinth Mod Manager

Similar to CurseForge:

- Searches Modrinth database
- Supports multiple project types (mods, modpacks, resource packs)
- Auto-selects compatible versions
- Extracts and integrates with server

## API Reference

### Search Endpoint Response Format

```typescript
interface SearchResponse {
  results: {
    id: string;           // Unique identifier
    name: string;         // Display name
    description: string;  // Full description
    author: string;       // Content creator
    version?: string;     // Current version
    downloads?: number;   // Download count
    updated?: ISO8601;    // Last update timestamp
    image?: string;       // Display image URL
  }[];
  total?: number;         // Total results available
  page?: number;          // Current page number
}
```

### Action Execution Request

```typescript
interface ExecuteActionRequest {
  serverId: string;       // Target server ID
  inputs: {
    contentId: string;    // From search results
    contentName: string;  // Display name
    [key: string]: any;   // Additional parameters
  };
  options?: {
    skipBackup?: boolean; // Skip pre-install backup
    skipRestart?: boolean; // Don't restart after install
  };
}
```

## Security Considerations

### Permissions Enforcement

- Plugin can only access files it has permission for
- API calls validated at parent process level
- Dangerous operations require explicit permissions

### Safe Defaults

- File downloads validated before execution
- Archives checked before decompression
- Server commands limited to configured permissions
- User input sanitized in all operations

### Community Plugin Security

When installing community plugins:
1. ✅ Automated security analysis runs
2. ✅ Trust level badge displayed (Official/Community)
3. ✅ Security report available for review
4. ✅ Permissions clearly stated before install
5. ⚠️ Review source code before installing untrusted plugins

## Development

### Project Structure

```
example-search-install/
├── README.md                 # This file
├── package.json              # Node.js project metadata
├── stellarstack.json         # Plugin manifest
└── (implementation files)    # Optional: plugin code
```

### Requirements

- Node.js 18.0.0 or higher
- StellarStack API 1.3.9 or higher
- Plugin SDK types (from @stellarstack/plugin-sdk)

### Local Testing

1. Clone repository
2. Install dependencies: `npm install`
3. Copy to StellarStack plugins directory
4. Restart API server
5. Enable plugin in admin panel
6. Test search and install actions

## Troubleshooting

### Search Results Not Showing

- ✅ Verify search endpoint is implemented
- ✅ Check endpoint returns correct JSON format
- ✅ Ensure plugin has `files.write` permission
- ✅ Review browser console for errors

### Install Fails

- ✅ Verify download URL is accessible
- ✅ Check server has write permissions to directory
- ✅ Ensure content is not already installed
- ✅ Review API logs for permission errors

### Action Timeout

- ✅ Increase timeout if downloading large files
- ✅ Check server internet connectivity
- ✅ Verify download URL responds quickly
- ✅ Consider splitting into smaller chunks

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests if applicable
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Resources

- [StellarStack Plugin SDK](https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK)
- [Plugin Development Guide](https://docs.stellarstack.com/plugins)
- [UI Schema Documentation](https://docs.stellarstack.com/plugins/ui-schemas)
- [Action System Reference](https://docs.stellarstack.com/plugins/actions)

## Support

For questions and support:
- 📖 Read the [StellarStack documentation](https://docs.stellarstack.com)
- 🐛 Report bugs on [GitLab Issues](https://gitlab.com/StellarStackOSS/example-search-install/-/issues)
- 💬 Join the community [Discord server](https://discord.gg/stellarstack)

## Changelog

### 1.0.0 (2024-01-30)
- Initial release
- Search and install UI schema
- Download and command execution operations
- Template variable support
- Example action definitions
