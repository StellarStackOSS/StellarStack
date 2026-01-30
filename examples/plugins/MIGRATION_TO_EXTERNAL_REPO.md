# Migration to External Plugin SDK Repository

## Overview

These example plugins are currently in the StellarStack monorepo but should be moved to the external **StellarStack-Plugin-SDK** repository to serve as official examples and starting points for community developers.

## What to Move

### 📦 Example Plugins (Core)

Move the entire `examples/plugins/` directory to the SDK repository:

```
StellarStack-Plugin-SDK/
├── examples/
│   ├── plugins/
│   │   ├── example-simple-form/
│   │   │   ├── stellarstack.json
│   │   │   └── package.json
│   │   ├── example-search-install/
│   │   ├── example-stats-dashboard/
│   │   ├── example-data-table/
│   │   ├── README.md
│   │   ├── PLUGIN_DEVELOPMENT_GUIDE.md
│   │   └── MIGRATION_TO_EXTERNAL_REPO.md
│   └── ... other examples
└── ...
```

### 📚 Documentation (Core)

- `PLUGIN_DEVELOPMENT_GUIDE.md` - Comprehensive plugin development guide
- `README.md` - Overview and quick start
- `MIGRATION_TO_EXTERNAL_REPO.md` - This file

### 🔧 SDK Types (Keep in Monorepo)

The following should **remain** in the StellarStack monorepo:

- `packages/plugin-sdk/src/ui-schema.ts` - Core type definitions
- `packages/plugin-sdk/src/index.ts` - SDK exports
- All SDK source files

## Migration Steps

### 1. Create External Repository Structure

```bash
# Create new structure in StellarStack-Plugin-SDK repo
mkdir -p examples/plugins
mkdir -p docs/guides
```

### 2. Copy Example Plugins

```bash
# Copy all example plugins
cp -r examples/plugins/* SDK/examples/plugins/

# Verify all examples
cd SDK/examples/plugins
ls -la
# Should show: example-simple-form, example-search-install, example-stats-dashboard, example-data-table
```

### 3. Copy Documentation

```bash
# Copy guides to docs
cp examples/plugins/PLUGIN_DEVELOPMENT_GUIDE.md SDK/docs/guides/
cp examples/plugins/README.md SDK/examples/plugins/
```

### 4. Update README in SDK

Update the main SDK `README.md` to include:

```markdown
## 📚 Plugin Development

- **[Plugin Development Guide](docs/guides/PLUGIN_DEVELOPMENT_GUIDE.md)** - Complete development reference
- **[Example Plugins](examples/plugins/README.md)** - Working examples to get started

### Quick Start

1. Read [Plugin Development Guide](docs/guides/PLUGIN_DEVELOPMENT_GUIDE.md)
2. Copy and customize an [example plugin](examples/plugins/)
3. Install in StellarStack admin panel
4. Share with the community!
```

### 5. Create Getting Started File

Create `SDK/GETTING_STARTED.md`:

```markdown
# Getting Started with Plugin Development

## 1. Understand the Basics

Read the [Plugin Development Guide](docs/guides/PLUGIN_DEVELOPMENT_GUIDE.md) to understand:
- Plugin manifest format
- UI schema types
- Actions and operations
- Permissions system

## 2. Choose a Starting Point

Pick an example that matches your needs:

- **Form-based UI?** Start with [`example-simple-form`](examples/plugins/example-simple-form/)
- **Search & Install?** Start with [`example-search-install`](examples/plugins/example-search-install/)
- **Metrics display?** Start with [`example-stats-dashboard`](examples/plugins/example-stats-dashboard/)
- **Data management?** Start with [`example-data-table`](examples/plugins/example-data-table/)

## 3. Customize Your Plugin

1. Copy the example directory
2. Edit `stellarstack.json`
3. Update plugin ID, name, and description
4. Customize actions and UI schema
5. Test in your StellarStack installation

## 4. Publish

1. Create a public GitHub repository
2. Push your customized plugin
3. Submit to plugin registry
4. Get featured in the marketplace!

See [README.md](examples/plugins/README.md) for detailed examples.
```

### 6. Update Links in Monorepo

Keep a reference in the monorepo's docs pointing to the external SDK:

In `packages/plugin-sdk/README.md`:

```markdown
## 📚 Plugin Examples

For working examples and detailed development guides, see the **[StellarStack-Plugin-SDK](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK)** repository:

- [Plugin Development Guide](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/blob/main/docs/guides/PLUGIN_DEVELOPMENT_GUIDE.md)
- [Example Plugins](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/tree/main/examples/plugins/)
  - [Simple Form Example](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/tree/main/examples/plugins/example-simple-form)
  - [Search & Install Example](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/tree/main/examples/plugins/example-search-install)
  - [Stats Dashboard Example](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/tree/main/examples/plugins/example-stats-dashboard)
  - [Data Table Example](https://github.com/StellarStackOSS/StellarStack-Plugin-SDK/tree/main/examples/plugins/example-data-table)
```

## What Stays in StellarStack Monorepo

✅ **SDK Type Definitions**
- `packages/plugin-sdk/src/ui-schema.ts`
- `packages/plugin-sdk/src/types.ts`
- `packages/plugin-sdk/src/index.ts`
- All SDK infrastructure

✅ **Schema Renderers**
- `apps/web/components/plugin-ui/`
- Frontend implementation of schema types

✅ **Plugin System Backend**
- `apps/api/src/lib/plugin-executor.ts`
- `apps/api/src/lib/plugin-audit.ts`
- `apps/api/src/middleware/plugin-auth.ts`
- Core plugin execution system

## What Moves to External SDK Repo

📦 **Example Plugins**
- `examples/plugins/example-simple-form/`
- `examples/plugins/example-search-install/`
- `examples/plugins/example-stats-dashboard/`
- `examples/plugins/example-data-table/`

📚 **Developer Documentation**
- `PLUGIN_DEVELOPMENT_GUIDE.md`
- `examples/plugins/README.md`
- Getting started guides
- API documentation (when expanded)

## File Structure After Migration

### StellarStack Monorepo

```
StellarStack/
├── packages/
│   └── plugin-sdk/
│       ├── src/
│       │   ├── ui-schema.ts (type definitions)
│       │   ├── types.ts
│       │   └── index.ts
│       └── README.md (links to SDK repo)
├── apps/
│   ├── api/
│   │   └── src/lib/
│   │       ├── plugin-executor.ts
│   │       ├── plugin-audit.ts
│   │       └── plugin-auth.ts
│   └── web/
│       └── components/plugin-ui/
│           ├── SchemaRenderer.tsx
│           ├── SearchAndInstallRenderer.tsx
│           ├── FormRenderer.tsx
│           └── ...
└── ... rest of monorepo
```

### StellarStack-Plugin-SDK Repo

```
StellarStack-Plugin-SDK/
├── docs/
│   └── guides/
│       └── PLUGIN_DEVELOPMENT_GUIDE.md
├── examples/
│   └── plugins/
│       ├── example-simple-form/
│       ├── example-search-install/
│       ├── example-stats-dashboard/
│       ├── example-data-table/
│       └── README.md
├── GETTING_STARTED.md
├── README.md
└── ... SDK infrastructure
```

## Benefits of This Structure

1. **Clear Separation of Concerns**
   - Examples live in dedicated SDK repository
   - Easier for community to find and fork

2. **Easier Community Contributions**
   - Developers can contribute examples separately
   - No need to understand full monorepo structure

3. **Better Documentation**
   - Focused, example-first documentation
   - Clear path for developers: docs → examples → customize

4. **Faster Updates**
   - Examples can be updated independently
   - No monorepo build required for documentation changes

5. **Community Discovery**
   - GitHub stars and forks on SDK repo
   - Dedicated space for community plugins

## Verification Checklist

After migration:

- [ ] All example plugins copied to SDK repo
- [ ] `PLUGIN_DEVELOPMENT_GUIDE.md` copied to SDK docs
- [ ] `examples/plugins/README.md` copied to SDK examples
- [ ] `GETTING_STARTED.md` created in SDK root
- [ ] SDK repo README updated with links
- [ ] Monorepo plugin-sdk README links to SDK repo examples
- [ ] All manifest files are valid JSON
- [ ] Each example has package.json
- [ ] Each example has proper metadata in stellarstack.json
- [ ] Links in all documentation are correct
- [ ] CI/CD configured for SDK repo
- [ ] Plugin registry points to SDK repo examples

## Next Steps

1. **Create the external repository** - StellarStack-Plugin-SDK (if not already done)
2. **Set up CI/CD** - Validate example manifests
3. **Create plugin registry** - List official and community plugins
4. **Launch marketplace** - Allow installation from admin panel
5. **Collect community contributions** - Set up process for community examples

## Related Documents

- See [PLUGIN_DEVELOPMENT_GUIDE.md](PLUGIN_DEVELOPMENT_GUIDE.md) for comprehensive guide
- See [README.md](README.md) for example overview
- See monorepo [packages/plugin-sdk/README.md](../../packages/plugin-sdk/README.md) for SDK info
