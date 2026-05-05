# StellarStack installer

A single Bash script — driven by [`gum`](https://github.com/charmbracelet/gum) for
prompts — that installs StellarStack in one of three shapes.

```bash
curl -fsSL https://stellarstack.io/install.sh | sudo bash
```

## Modes

| Mode | What it does |
|---|---|
| `full` | panel + API + daemon + Postgres + Redis + Caddy on this box. One-line install for indie hosts on a single dedicated machine. |
| `panel` | panel + API + Postgres + Redis + Caddy. Daemons live on separate hosts and pair against this panel using `daemon` mode below. |
| `daemon` | Just the Go daemon binary, written to `/usr/local/bin/stellar-daemon`, plus a systemd unit. Pairs against an existing panel using a token from Admin → Nodes → Add. |

Run interactively for the menu, or skip the picker by passing the mode as an
argument:

```bash
sudo bash install.sh full
sudo bash install.sh panel
sudo bash install.sh daemon
sudo bash install.sh uninstall
```

## What's where

```
installers/
├── install.sh                   ← entry point
└── templates/
    ├── docker-compose.full.yml  ← full stack (5 services)
    ├── docker-compose.panel.yml ← no daemon service
    ├── Caddyfile.tmpl           ← reverse proxy + auto-TLS
    └── stellar-daemon.service   ← systemd unit
```

The installer copies these into `/etc/stellarstack/` at install time, after
substituting the operator's chosen hostname / data directory.

## What it generates

On first run the installer writes:

- `/etc/stellarstack/.env` — Postgres + JWT + better-auth secrets, generated
  freshly. Mode `0600`. **Never overwritten on re-run.**
- `/etc/stellarstack/docker-compose.yml` — copy of the chosen template.
- `/etc/stellarstack/Caddyfile` — with `__PANEL_HOST__` substituted.
- `/var/lib/stellarstack/{postgres,redis,servers,backups,caddy}` — bind mounts.

For daemon-only:

- `/usr/local/bin/stellar-daemon` — fetched binary, atomic `mv` swap.
- `/etc/systemd/system/stellar-daemon.service`.

## Re-running

The installer is idempotent. On a second run:

- `.env` is detected and **left alone** (so admin passwords / signing keys
  don't get rotated under your nose).
- Docker compose templates are overwritten — that's how you pick up changes.
- `docker compose pull && docker compose up -d` brings everything up to the
  latest tag.

## Uninstall

```bash
sudo bash install.sh uninstall
```

Walks through three confirmations: stop+remove the compose stack, remove the
daemon systemd unit, wipe `/var/lib/stellarstack` (irreversible — last prompt
defaults to no).

## Pre-flight

Before doing anything destructive the script checks:

- Running as root (`EUID == 0`).
- Docker is installed and reachable. If not, offers to run
  `get.docker.com`.
- Ports 80 (and 443 if TLS is on) are free, warns otherwise.
- Architecture is `x86_64` or `aarch64` for the daemon binary download.

## Pairing a daemon

After installing in `panel` mode:

1. Open the panel, sign in, go to **Admin → Nodes → Add**.
2. Copy the pairing token (one-shot, expires).
3. On the daemon host:

   ```bash
   curl -fsSL https://stellarstack.io/install.sh | sudo bash -s -- daemon
   ```

   You'll be prompted for the panel URL and the token.

The pairing handshake mints a per-node HMAC key on the panel side and writes
it to the daemon's config under `/var/lib/stellarstack/config.toml`.

## Things this installer **doesn't** do (yet)

- Self-update. Re-run the script with the same mode and it'll pull fresh
  images / a new daemon binary, but there's no `stellarstack upgrade`
  one-shot. Tracked separately.
- Bring-your-own Postgres. Compose-managed PG only. If you want an external
  one, edit `docker-compose.yml` and `.env` after install.
- Multi-architecture support beyond `amd64` and `arm64`.
- Windows or Mac hosts. Linux only — daemon needs Docker on the same host.
