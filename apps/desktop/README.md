# desktop

Electron app that bundles the StellarStack panel + API + daemon into a
single-node desktop install for Windows, macOS, and Linux. Docker is the
only thing the user has to install themselves — game-server containers
run there. Everything StellarStack-related ships in the installer.

## Runtime layout

When the user double-clicks the app:

1. **Bootstrap window** opens. Checks `docker version`. If missing, a
   one-click link to the install page; if installed but stopped, a
   recheck button.
2. Once Docker is up, the app **pulls + starts a `stellar-postgres`
   container** (idempotent — exists between launches via a Docker
   volume named `stellar-pgdata`).
3. **API spawns** as a Node child process — `apps/api`'s esbuild bundle
   shipped inside the installer. Connects to the local Postgres on
   `localhost:25432`.
4. **Daemon spawns** as a Go child process — `apps/daemon` binary, owns
   the Docker socket for game-server containers.
5. **Panel window opens** loading `apps/web`. Talks REST to the local
   API and WebSocket to the local daemon.

```
┌─ Electron main process ────────────────────────────────────────┐
│                                                                │
│  Bootstrap window  →  Panel window (apps/web)                  │
│                                                                │
│  Sidecars (spawned + supervised by main):                      │
│    ├─ apps/api  (Node, esbuilt)        ─────┐                  │
│    └─ apps/daemon  (Go binary)              │                  │
│                                              │                  │
└──────────────────────────────────────────────┼──────────────────┘
                                                │
                                  ┌─────────────┴─────────────┐
                                  │ User's Docker             │
                                  │   ├─ stellar-postgres     │
                                  │   └─ <game-server>...n    │
                                  └───────────────────────────┘
```

## Layout

```
apps/desktop/
├── src/
│   ├── main/
│   │   ├── index.ts        single-instance lock, IPC, window lifecycle
│   │   ├── env.ts          paths + ports for dev/prod
│   │   ├── docker.ts       `docker version` probe → ok / missing / not-running
│   │   ├── postgres.ts     ensures the `stellar-postgres` container is running
│   │   ├── api.ts          spawns + supervises the API sidecar
│   │   └── daemon.ts       spawns + supervises the Go daemon
│   ├── preload/index.ts    contextBridge → window.stellar.*
│   └── bootstrap/index.html first-run window UI
├── scripts/
│   ├── copy-assets.mjs     copies non-TS files into dist/
│   └── bundle-api.mjs      esbuilds apps/api into a single CommonJS sidecar
├── build/                  outputs from the build steps (gitignored)
├── electron-builder.yml    mac dmg / win nsis / linux AppImage
├── tsconfig.json
└── package.json
```

## Dev

```bash
cd apps/desktop
pnpm install

# Build the daemon for your local OS first:
go build -o build/stellar-daemon ../daemon/cmd/stellar-daemon

# Bundle the API (and copy its runtime deps):
pnpm bundle:api

# In another terminal, start the panel dev server:
pnpm --filter web dev   # http://localhost:3000

# Then run the app:
pnpm dev
```

The first window is the bootstrap. It'll start Postgres in Docker if it
isn't already running, then open the main panel window pointed at the
running services.

## Production builds

```bash
# Build the panel.
pnpm --filter web build

# Build the daemon for the target platform.
GOOS=darwin GOARCH=arm64 go build -o build/stellar-daemon \
  ../daemon/cmd/stellar-daemon

# Build the desktop installer.
pnpm build:mac     # → release/StellarStack-0.1.0.dmg
pnpm build:win     # → release/StellarStack-0.1.0-setup-x64.exe
pnpm build:linux   # → release/StellarStack-0.1.0.AppImage
```

`build:mac` / `build:win` / `build:linux` chain through `build:tsc`,
which runs `tsc`, copies bootstrap HTML, and bundles the API. The
output is then handed to `electron-builder` per `electron-builder.yml`.

## Why Postgres in a container

The API is hard-wired to Postgres for the hosted product. Rather than
maintain a parallel SQLite schema for desktop only, we exploit the fact
that we're already requiring Docker — start a tiny Postgres container,
mount its data on a named volume, point the API at it. One image (~80 MB
compressed), ~50 MB RAM at idle, persistent across launches.

If we ever want to drop the Docker dependency, the move is to embed
PGlite (Postgres-in-WASM) — same SQL, in-process, no Docker. Out of
scope for v1.

## Security model

The renderer (the panel UI) runs with `contextIsolation: true` and
`nodeIntegration: false`. It can only call the IPC channels exposed by
`src/preload/index.ts`. There's no `require()`, no filesystem access,
no shell execution from inside the panel.

External links open in the user's default browser via
`shell.openExternal`, never inside the Electron window.
