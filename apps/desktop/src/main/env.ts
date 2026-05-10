import path from "node:path"

import { app } from "electron"

// Where bundled binaries (daemon + api) live in a packaged build vs. dev.
// In dev we expect them to be available on $PATH or already running.
const isDev = !app.isPackaged

export const env = {
  isDev,

  /** Where the panel UI is served from. In dev, the apps/web Vite server
   *  on :3000. In prod, served from the packaged static bundle via the
   *  `stellar://` custom protocol registered in main/index.ts. */
  panelUrl: isDev ? "http://localhost:3000" : "stellar://panel/index.html",

  /** Filesystem path to the bundled `apps/web/dist` in a packaged build. */
  panelDistPath: path.join(process.resourcesPath, "panel"),

  /** Filesystem path to the bundled daemon binary (Go). In dev we read
   *  it from `apps/desktop/build/` (the developer copies or builds it
   *  there before `pnpm dev`); in prod electron-builder lays it down
   *  inside the app's `resources/` dir. */
  daemonBinaryPath: isDev
    ? path.resolve(
        process.cwd(),
        "build",
        process.platform === "win32" ? "stellar-daemon.exe" : "stellar-daemon"
      )
    : path.join(
        process.resourcesPath,
        process.platform === "win32" ? "stellar-daemon.exe" : "stellar-daemon"
      ),

  /** Filesystem path to the bundled API entrypoint (Node bundle, esbuilt
   *  from `apps/api`). The desktop app spawns this as a sidecar so the
   *  main process keeps a clean event loop for window management. */
  apiEntrypoint: isDev
    ? path.resolve(process.cwd(), "build", "api", "main.mjs")
    : path.join(process.resourcesPath, "api", "main.mjs"),

  /** Local port the API binds to. The panel UI talks to it here. */
  apiPort: 18080,

  /** Local port the daemon binds for browser ↔ daemon WebSockets +
   *  API → daemon HTTP. Matches `nodes.daemon_port` written by /setup. */
  daemonPort: 18081,

  /** Local port the daemon's embedded SFTP server binds. */
  sftpPort: 12022,

  /** Per-OS data dir for the daemon's local files (server bind-mounts,
   *  daemon config). The Postgres data lives in a Docker volume managed
   *  by `postgres.ts`, not in this directory. */
  dataDir: app.getPath("userData"),

  /** Path the daemon's TOML config is written to before spawn. */
  daemonConfigPath: path.join(app.getPath("userData"), "daemon.toml"),

  /** Where the bundled `packages/db/drizzle/` folder lives in a packaged
   *  build. The API auto-applies migrations from here on boot. */
  migrationsPath: isDev
    ? path.resolve(process.cwd(), "..", "..", "packages", "db", "drizzle")
    : path.join(process.resourcesPath, "migrations"),
} as const
