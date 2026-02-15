# Plugin SDK Repository Structure

## Overview

StellarStack maintains an external **[StellarStack-Plugin-SDK](https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK)** repository as the central location for:

- ✅ Example plugins for developers to learn from
- ✅ Official plugins maintained by the StellarStack team
- ✅ Plugin development documentation and guides
- ✅ Reference implementations and best practices

## Architecture

### Monorepo (StellarStack)

Contains **core plugin system infrastructure**:

- Plugin manager, executor, security analyzer
- Plugin API routes and middleware
- UI schema renderer components
- Permission enforcement system
- Audit logging and monitoring

**Does NOT contain plugin implementations** - see SDK repository.

### SDK Repository (StellarStack-Plugin-SDK)

Contains **all plugin code and examples**:

- Example plugins (community templates)
- Official plugins (team-maintained)
- Plugin development guides
- Quick start templates

## Directory Structure

### Monorepo: `examples/plugins/` (DOCUMENTATION ONLY)

```
StellarStack/examples/plugins/
├── README.md                      # Getting started guide
├── PLUGIN_DEVELOPMENT_GUIDE.md    # Comprehensive reference
└── MIGRATION_TO_EXTERNAL_REPO.md  # This file - architecture docs
```

**Purpose:** Guide developers to the SDK repository.

### SDK Repository: Planned Structure

```
StellarStack-Plugin-SDK/
├── README.md                      # Repository overview
├── GETTING_STARTED.md             # Quick start
├── docs/
│   └── guides/
│       └── PLUGIN_DEVELOPMENT_GUIDE.md  # (copied from monorepo)
├── examples/
│   └── plugins/
│       ├── official/
│       │   ├── curseforge-installer/
│       │   │   ├── package.json
│       │   │   └── stellarstack.json
│       │   ├── modrinth-installer/
│       │   │   ├── package.json
│       │   │   └── stellarstack.json
│       │   └── server-announcer/
│       │       ├── package.json
│       │       └── stellarstack.json
│       ├── example-simple-form/
│       │   ├── package.json
│       │   ├── stellarstack.json
│       │   └── README.md
│       ├── example-search-install/
│       ├── example-stats-dashboard/
│       ├── example-data-table/
│       └── README.md
└── ...
```

## What Gets Duplicated?

### Documentation

The following files appear in both places:

- `PLUGIN_DEVELOPMENT_GUIDE.md` - Comprehensive development guide
- `README.md` - Getting started guide

**Why duplicate?**

- Monorepo is accessible to all developers
- SDK repo is the main hub for plugins
- Ensures both stay in sync

### Plugins

Plugins exist ONLY in the SDK repository:

- Official plugins (curseforge, modrinth, server-announcer)
- Example plugins (simple-form, search-install, etc.)

## Migration Timeline

### Phase 1: ✅ COMPLETE

- Plugin system infrastructure built in monorepo
- Git-based installation implemented
- Security analysis working
- Documentation guides created

### Phase 2: 📋 IN PROGRESS

- Create StellarStack-Plugin-SDK repository (if needed)
- Populate with example plugins
- Populate with official plugins
- Set up CI/CD for plugin validation

### Phase 3: 🔮 PLANNED

- Official plugins installable from SDK
- Plugin marketplace/registry
- Auto-update system
- Community plugin submissions

## How to Access Plugins

### As a Developer

```bash
# Clone the SDK repository
git clone https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK
cd StellarStack-Plugin-SDK/examples/plugins

# Copy an example
cp -r example-simple-form my-plugin
cd my-plugin

# Customize stellarstack.json
nano stellarstack.json

# Push to GitLab and install via Git URL in StellarStack
```

### As a User

1. Open StellarStack Admin Panel
2. Navigate to: Admin → Plugins → Marketplace
3. Enter Git repository URL (e.g., `https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK`)
4. Select desired plugin and click Install
5. Configure plugin settings
6. Enable and use

## Plugin Distribution

### Built-in Plugins

- Shipped with StellarStack installation
- Cannot be uninstalled
- Updated with monorepo releases
- Examples: CurseForge, Modrinth, Server Announcer

### Community Plugins

- Installed from Git repositories
- Can be uninstalled anytime
- Updated independently
- Can be forked and modified
- Examples: User-created plugins

### Official Plugins (In SDK)

- Maintained by StellarStack team
- Available in SDK repository
- Can be installed like community plugins
- Example sources for developers
- Provide best-practice reference

## Version Management

### Synchronization

```
StellarStack v1.3.9
├── Built-in plugins v1.0.0
└── SDK Repository v1.3.9
    ├── Official plugins v1.0.0
    └── Documentation v1.3.9
```

Versions are kept synchronized:

- Plugin versions are fixed (semver)
- SDK repository has release tags matching StellarStack versions
- Documentation is updated with each release

### Updates

- Built-in plugins: Updated via StellarStack releases
- SDK plugins: Updated independently via Git
- Developers: Choose which version to use

## Key Principles

### 1. Separation of Concerns

- **Monorepo:** Plugin system infrastructure
- **SDK Repo:** Plugin implementations

### 2. Developer-Friendly

- Clear examples to learn from
- Easy to fork and customize
- Well-documented patterns
- Open-source implementations

### 3. Maintainability

- Official plugins clearly identified
- Examples serve as reference implementations
- Documentation stays with code
- Easy to contribute improvements

### 4. Security

- All plugins validated before installation
- Automatic security scanning
- Permission system enforced
- Audit logging enabled

## Getting Started for Developers

### To Create a Plugin

1. Visit [StellarStack-Plugin-SDK](https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK)
2. Read the [Plugin Development Guide](../PLUGIN_DEVELOPMENT_GUIDE.md)
3. Copy an example plugin
4. Customize for your needs
5. Test in StellarStack admin panel
6. Share with the community!

### To Install Existing Plugins

1. Find plugin repository URL
2. Open StellarStack Admin Panel
3. Navigate to Plugins → Marketplace
4. Paste Git URL and click Install
5. Configure plugin settings
6. Enable and use

## Documentation Location

```
StellarStack Monorepo (This Repo)
├── examples/plugins/README.md                    ← You are here
├── examples/plugins/PLUGIN_DEVELOPMENT_GUIDE.md ← Development reference
└── examples/plugins/MIGRATION_TO_EXTERNAL_REPO.md ← This file

StellarStack-Plugin-SDK (External Repo)
├── README.md                           ← Repository overview
├── GETTING_STARTED.md                  ← Quick start guide
├── docs/guides/PLUGIN_DEVELOPMENT_GUIDE.md ← Same as above (copied)
└── examples/plugins/                   ← All plugin code
```

## Related Repositories

- **[StellarStack](https://gitlab.com/StellarStackOSS/stellarstack)** - Main application (this repo)
- **[StellarStack-Plugin-SDK](https://gitlab.com/StellarStackOSS/StellarStack-Plugin-SDK)** - Plugin examples and official plugins
- **[StellarStack Docs](https://docs.stellarstack.io)** - Full documentation

## Questions or Feedback?

- **Plugin Development:** See [PLUGIN_DEVELOPMENT_GUIDE.md](PLUGIN_DEVELOPMENT_GUIDE.md)
- **Getting Started:** See [README.md](README.md)
- **Issues:** Report at [GitLab Issues](https://gitlab.com/StellarStackOSS/stellarstack/issues)
- **Discussions:** Join [GitLab Issues](https://gitlab.com/StellarStackOSS/stellarstack/discussions)

---

**Last Updated:** January 30, 2026
**Status:** Phase 1 Complete, Phase 2 In Progress
