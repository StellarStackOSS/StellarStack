<p align="center">
  <img src="logo.png" width="120" height="120" alt="StellarStack" />
</p>

<h1 align="center">StellarStack</h1>

<p align="center">
  <strong>Open-source server hosting, done correctly.</strong>
  <br />
  A modern game-server control panel — multi-node, blueprint-driven, browser-direct daemon WebSocket.
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#features">Features</a> ·
  <a href="#deploying-self-host">Deploying</a> ·
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img alt="early access" src="https://img.shields.io/badge/status-early%20access-A397E8?style=flat-square" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-white?style=flat-square" />
  <img alt="node" src="https://img.shields.io/badge/node-20%2B-white?style=flat-square" />
  <img alt="go" src="https://img.shields.io/badge/go-1.22%2B-white?style=flat-square" />
</p>

---

> ### 🚧 Heads up — very early access
> StellarStack is released and runnable, but it's still under active
> development. Expect rough edges and frequent releases. Don't put a
> tournament on it; do use it for the home server, the friends-group
> Minecraft, the staging setup. File issues — we read them.

## What it is

StellarStack is the panel you put in front of every game server you run.
One UI for Minecraft, Rust, Palworld, Valheim, ARK, anything else Docker
can run. It owns Docker on each node, mints scoped tokens so your
browser talks to the daemon directly (no panel middleman in the live
path), and gives players, admins and friends each the access they need
without sharing root.

If you've used Pterodactyl, Pelican, or AMP — same problem space,
modern stack, opinionated rebuild. **Free, open-source, no hosted plan
to upsell you to.**

## Features

| | |
| --- | --- |
| **Per-server console** | Streaming stdout/stderr with ANSI handling, stdin wired straight to the container. Ask AI sends the last N lines + your question to a model for triage. |
| **Live resource graphs** | CPU, memory, disk I/O, network — streamed from the daemon, no polling. |
| **Power lifecycle** | Start / stop / restart / kill with a per-server lock. Restart holds the lock end-to-end so transitions read cleanly. |
| **Blueprint-driven readiness** | `starting → running` is gated on the blueprint's console-done patterns. No guesses. |
| **Schedules** | Cron-driven typed flows: action nodes (start/stop/backup/console) and wait nodes (until offline, until backup complete, N seconds). Real wait gates, not `sleep 30`. |
| **Backups** | Local + S3 destinations, per-server cap, atomic restore. |
| **File manager** | Browse, edit (Monaco), upload, decompress (zip / tar.gz / tar.zst). Browser-direct, JWT-gated. |
| **SFTP** | Per-server credentials minted on demand. No shared root. |
| **Subusers + scopes** | Per-server permission grants. Friend can power-cycle, can't delete the server. |
| **Server splitting** | Carve a parent's resource pool into child instances with their own containers + consoles. |
| **Crash reports** | Container exit while running → captured log tail + memory snapshot. |
| **Audit log** | Every admin-impacting action recorded with actor + IP + metadata. |
| **2FA + passkeys** | TOTP and WebAuthn with backup codes. |
| **Multi-node** | Single Go daemon binary; pair as many as you want. The panel routes per server. |

## Tech stack

| Layer            | Stack                                                          |
| ---------------- | -------------------------------------------------------------- |
| Monorepo / tasks | pnpm workspaces + Turborepo                                    |
| Panel UI         | React 19 · TypeScript · Vite · Tailwind 4 · TanStack Router/Query · shadcn/ui · framer-motion · xyflow |
| API              | Node 20 · Hono · better-auth · Drizzle ORM                     |
| Daemon           | Go 1.22 · Docker engine API                                    |
| Database         | Postgres 16                                                    |
| Cache            | Redis 7 (status cache)                                         |
| Storage          | Local filesystem + S3-compatible (MinIO / R2 / B2 / AWS S3)    |
| Marketing site   | Vite · React · framer-motion · Markdown-driven blog            |

## Repo layout

```
.
├── apps/
│   ├── api/        Hono API — auth, server CRUD, JWT mint, install runner, schedules
│   ├── daemon/     Go daemon — per-server WS, Docker, files, SFTP, backups
│   ├── web/        React panel
│   └── home/       Marketing site (stellarstack.app)
├── packages/
│   ├── db/         Drizzle schema + migrations
│   ├── shared/     Shared types, error codes, locales, blueprints schema
│   ├── ui/         Workspace UI primitives (cards, sidebar, dialog, …)
│   ├── sdk/        Typed client for the API
│   └── blueprints/ Reference blueprints + Pterodactyl egg converter
├── infra/
│   ├── docker/     Compose stack (Postgres / Redis / MinIO / Mailpit)
│   └── scripts/    Bootstrap + seed
├── turbo.json
└── pnpm-workspace.yaml
```

## Architecture

```
Browser ──REST──▶ API ──HTTP──▶ Daemon ──Docker──▶ Containers
   │                  │            ▲
   │                  ├──Postgres  │
   │                  └──Redis     │
   │                               │
   └─────WS (console + stats + SFTP)
```

The interesting bit: **browsers dial the daemon directly** for console,
stats, and SFTP. The API mints a scoped JWT, the browser hands it to
the daemon, and the live path stays clear of the panel. The daemon
posts state changes back to the API over HMAC-signed HTTP so the panel
DB stays the source of truth.

Read [`apps/daemon/internal/server/`](apps/daemon/internal/server) for
the power-state machine and probe runner, and
[`apps/api/src/routes/`](apps/api/src/routes) for the HTTP surface.

## Quickstart

For the lazy, on a Linux box with Docker installed:

```bash
git clone https://github.com/StellarStackOSS/StellarStack-V2.git
cd StellarStack-V2

pnpm install                                    # Node deps
cp infra/docker/.env.example infra/docker/.env  # rotate secrets before running
pnpm dev:infra                                  # Postgres + Redis + MinIO + Mailpit
pnpm db:migrate                                 # apply schema
pnpm db:seed                                    # admin user + Minecraft blueprint

# Build the daemon (Go 1.22+)
cd apps/daemon && go build ./cmd/stellar-daemon && cd -

# Run the stack: api + web + home + daemon
pnpm dev
```

The panel will be on `http://localhost:5173`, the API on
`http://localhost:3000`. The seed script prints admin credentials on
first run.

To pair the daemon, sign in as admin, open **Admin → Nodes → New node**,
generate a pairing token, then on the daemon host:

```bash
./apps/daemon/stellar-daemon configure http://localhost:3000 <pairing-token>
./apps/daemon/stellar-daemon -config /etc/stellar-daemon/config.toml
```

## Deploying (self-host)

The supported deploy path is the bundled Docker Compose stack.

### 1. Server prerequisites

| | Minimum | Recommended |
| --- | --- | --- |
| OS  | Ubuntu 22.04, Debian 12, or any modern systemd distro | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB+ (panel only; game servers need their own headroom) |
| Disk | 20 GB SSD | 40 GB SSD |
| Docker | 24+ | latest |

Daemon hosts can be the same box for a home install, or separate
machines per node for production.

### 2. Configure

```bash
git clone https://github.com/StellarStackOSS/StellarStack-V2.git
cd StellarStack-V2

cp infra/docker/.env.example infra/docker/.env
# Edit infra/docker/.env:
#   - Rotate POSTGRES_PASSWORD
#   - Set BETTER_AUTH_SECRET to a 32+ char random string
#   - Point BETTER_AUTH_URL + PUBLIC_APP_URL at your domain
```

### 3. Run

```bash
pnpm install
pnpm stack:up    # builds + starts every service
```

Services come up in dependency order. Migrations run automatically on
the API container's first boot; the seed script gives you a starter
admin.

To watch logs:

```bash
pnpm stack:logs
```

To stop (data persists in Docker volumes):

```bash
pnpm stack:down
```

### 4. Front it with TLS

Put Caddy / Traefik / nginx in front and point them at the API container
(`:3000`), the panel (`:5173`), and the daemon (`:8080`, `:2022` for
SFTP). Caddy is the lazy choice:

```
panel.example.com {
  reverse_proxy api:3000
}
daemon.example.com {
  reverse_proxy daemon:8080
}
```

## Local development

```bash
# Run just one service while iterating
pnpm --filter api dev          # API on :3000
pnpm --filter web dev          # panel on :5173
pnpm --filter home dev         # marketing site on :4000
./apps/daemon/stellar-daemon -config /etc/stellar-daemon/config.toml

# Typecheck the whole repo
pnpm typecheck

# Format
pnpm format

# Regenerate the error-code TS union from the i18n catalog
pnpm --filter @workspace/shared codegen:errors
```

When changing the DB schema:

```bash
pnpm --filter @workspace/db db:generate   # emits a new SQL file under drizzle/
pnpm --filter @workspace/db db:migrate    # applies it
```

The seed script (`infra/scripts/seed.ts`) is idempotent — re-running it
won't duplicate the admin or the blueprint, it just upserts them.

## Roadmap

The live roadmap lives on the marketing site:
**[stellarstack.app/#/roadmap](https://stellarstack.app/#/roadmap)**

In rough order: public beta packaging, 2FA passkey polish, auto-update,
database hosting (Postgres / MySQL / Mongo containers attached to
servers), plugin marketplace, crash fingerprinting.

## Contributing

Issues and PRs are welcome. A few ground rules:

- Open an issue before a large PR so we can sync on direction.
- TypeScript is strict — no `any` / `unknown`, no inline `// @ts-ignore`.
  Same for the Go side: idiomatic, `go vet` clean, errors wrapped with
  context.
- Don't introduce a new dependency without a one-paragraph
  justification in the PR description.
- Commit messages: imperative, one-line summary, body if it helps
  reviewers (`fix(api): …`, `feat(daemon): …`, `chore(repo): …`).

## Security

If you find a vulnerability, **don't open a public issue**. Email
`security@stellarstack.app` with details and we'll respond within five
business days.

## License

MIT. See [LICENSE](LICENSE).

<p align="center">
  <a href="https://stellarstack.app">stellarstack.app</a> ·
  <a href="https://stellarstack.app/#/blog">Blog</a> ·
  <a href="https://stellarstack.app/#/changelog">Changelog</a>
</p>
