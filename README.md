<p align="center">
  <img src="icon.png" width="128" height="128" alt="StellarStack icon" />
</p>

<h1 align="center">StellarStack</h1>

<p align="center">
  An open-source game-server control panel — multi-node, multi-blueprint, browser-direct daemon WebSocket.
</p>

## Features

- **Browser-direct daemon WebSocket** — power, console, stats and command flow over a single per-server socket; the API stays out of the live path
- **Per-server console** — streaming stdout/stderr with auto-scroll, ANSI handling, and a command input wired straight to the container's stdin
- **Live resource graphs** — CPU, memory, disk I/O and network charts with hover tooltips, rendered from the daemon's stats stream
- **Power lifecycle** — start / stop / restart / kill with a per-server lock; restart holds the lock end-to-end so state transitions read cleanly
- **Blueprint-driven readiness** — `starting → running` is gated on the blueprint's console-done patterns, not a guess at "container is up"
- **Config-file patching** — blueprints declare `configFiles` (e.g. `server.properties`) and the daemon rewrites them with the resolved env on every start so port changes actually land
- **EULA detection** — the daemon scans console output for the canonical Minecraft EULA prompt and surfaces a one-click accept-and-restart modal in the panel
- **Install / reinstall** — separate install container, persistent log file, streaming overlay in the UI; reinstall stops the runtime container before running the script so the install can't race the live game
- **Server splitting (instances)** — carve a parent's resource pool into child instances with their own containers, drawing CPU / memory / disk from the parent's allocation
- **File manager** — browse, edit, upload, move, decompress (zip / tar / tar.gz / tgz / gz), with paginated tables and a Monaco editor for file content
- **Backups** — local + S3 destinations, per-server cap, archive / restore, with progress in the UI
- **Schedules** — cron-driven power actions, console commands, and backups
- **Subusers** — per-server permissions (console, files, sftp, control)
- **SFTP** — per-server credentials minted on demand from the panel
- **Audit log** — every server action recorded with actor, action, target, metadata, IP
- **Admin** — nodes, users, blueprints, servers, audit log
- **Pluggable daemon** — multi-node, HMAC-signed callbacks, fresh config pull on every power action

## Tech stack

| Layer           | Technology                               |
| --------------- | ---------------------------------------- |
| Package manager | pnpm                                     |
| Monorepo        | Turborepo                                |
| API             | Hono on Node.js, better-auth             |
| Daemon          | Go, Docker engine API                    |
| Frontend        | React 19, TypeScript, Vite               |
| Routing         | TanStack Router                          |
| State           | TanStack Query, Zustand                  |
| Styling         | Tailwind CSS 4, shadcn/ui, Radix UI      |
| DB              | Postgres + Drizzle ORM                   |
| Cache           | Redis (status cache, queue glue)         |
| Editor          | Monaco                                   |
| Animations      | Motion (Framer Motion)                   |

## Project structure

```
├── apps/
│   ├── api/                # Hono API (auth, server CRUD, JWT mint, install runner)
│   ├── daemon/             # Go daemon (per-server WS, container management, files)
│   └── web/                # React panel (Vite)
├── packages/
│   ├── db/                 # Drizzle schema + migrations
│   ├── shared/             # Shared types, error codes, locales
│   ├── ui/                 # shadcn primitives + StellarStack components
│   └── blueprints/         # Converted blueprints + the conversion tool
├── planets/                # Container image definitions (separate repo, see below)
├── turbo.json              # Turborepo task config
└── package.json            # pnpm workspace root
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Go 1.22+
- Docker
- Postgres 16
- Redis 7

### Install & run

```bash
# Clone
git clone https://github.com/StellarStackOSS/StellarStack-V2.git
cd StellarStack-V2

# Install JS deps
pnpm install

# Spin up Postgres + Redis (docker compose stack)
pnpm dev:infra

# Run migrations + seed
pnpm --filter @workspace/db db:migrate
pnpm --filter @workspace/db db:seed

# Build the daemon
cd apps/daemon && go build ./cmd/stellar-daemon && cd -

# Pair the daemon to your local node
./apps/daemon/stellar-daemon configure <pairing-token-from-admin>

# Start everything (api + web + daemon)
pnpm dev
```

### Other commands

```bash
# Run the API only
pnpm --filter api dev

# Run the panel only
pnpm --filter web dev

# Run the daemon only
./apps/daemon/stellar-daemon start

# Typecheck the whole repo
pnpm -r typecheck

# Regenerate error-code types from the i18n catalog
pnpm --filter @workspace/shared codegen:errors
```

## Architecture

```
Browser ──(REST: auth, server CRUD, /servers/:id/credentials)──> API (Hono)
   │                                                                │
   │                                                                ├──> Postgres
   │                                                                ├──> Redis (status cache)
   │                                                                └──(HTTP: install, files, backup ops)──> Daemon
   │
   └──(WS: power + state + console + stats, single socket per server)──> Daemon (Go)
                                                                        │
                                                                        └──(HTTP push: status + audit)──> API
```

Power actions flow over the per-server WebSocket as `{event:"set state", args:["start"]}` etc. The daemon owns the synchronous power chain; the API just persists the transitions the daemon pushes back via HMAC-signed callbacks.

## Planets (container images)

Container image definitions live in [`StellarStackOSS/StellarStack-Planets`](https://github.com/StellarStackOSS/StellarStack-Planets) and are published to GHCR as a single package with one tag per planet:

```
ghcr.io/stellarstackoss/planets:java_25
ghcr.io/stellarstackoss/planets:games_rust
ghcr.io/stellarstackoss/planets:python_3.11
```

Each blueprint references one or more of these tags via its `dockerImages` map.

## License

MIT.
