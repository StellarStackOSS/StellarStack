import { spawn, type ChildProcessByStdio } from "node:child_process"
import fs from "node:fs"
import type { Readable } from "node:stream"

import { env } from "./env"
import { POSTGRES_URL, REDIS_URL } from "./infra"

type ApiChild = ChildProcessByStdio<null, Readable, Readable>

/**
 * Spawns `apps/api`'s esbuild bundle as a child Node process. The API
 * needs Postgres + Redis reachable; the desktop app's `ensureInfraRunning`
 * (in infra.ts) makes sure both containers are up before this is called.
 *
 * The API's env shape matches `apps/api/src/env.ts`; we stub out the
 * SaaS-only integrations (Stripe, SMTP) with sensible local defaults.
 */
export class ApiProcess {
  private child: ApiChild | null = null

  public start(params: {
    daemonKey: string
    daemonNodeId: string
    authSecret: string
  }): void {
    if (this.child !== null) return
    const entry = env.apiEntrypoint
    if (!fs.existsSync(entry)) {
      console.error(
        `[api] entrypoint missing at ${entry}. ` +
          (env.isDev
            ? "Run `pnpm bundle:api` first."
            : "Reinstall the app.")
      )
      return
    }
    const child = spawn(
      process.execPath, // bundled Node from Electron itself
      [entry],
      {
        cwd: env.dataDir,
        stdio: ["ignore", "pipe", "pipe"] as const,
        env: {
          ...process.env,
          // Tell Electron's Node to behave like vanilla Node for the
          // child process — no chrome runtime quirks.
          ELECTRON_RUN_AS_NODE: "1",

          // Force NODE_ENV=production for the bundled API regardless of
          // whether the desktop app itself is in dev mode. The bundle
          // can't load pino-pretty's worker (it does
          // `join(__dirname, "lib", "worker.js")` which only resolves
          // when pino lives in a real on-disk node_modules tree, not
          // inlined in an ESM bundle). Production mode skips the
          // transport entirely; logs come out as plain JSON which is
          // exactly what the desktop log panel renders anyway.
          NODE_ENV: "production",
          PORT: String(env.apiPort),
          DATABASE_URL: POSTGRES_URL,

          // The infra manager (see infra.ts) ensures Postgres + Redis
          // are running in their stellar-{postgres,redis} containers.
          REDIS_URL,
          BETTER_AUTH_SECRET: params.authSecret,
          APP_BASE_URL: `http://localhost:${String(env.apiPort)}`,
          API_BASE_URL: `http://localhost:${String(env.apiPort)}`,
          LOG_LEVEL: env.isDev ? "debug" : "info",

          // Run migrations on boot from the bundled drizzle folder.
          STELLAR_AUTO_MIGRATE_PATH: env.migrationsPath,
          STELLAR_BLUEPRINTS_PATH: env.blueprintsPath,
          // Pre-shared values the API uses to seed the local node row
          // matching the daemon's TOML config.
          STELLAR_DESKTOP_DAEMON_KEY: params.daemonKey,
          STELLAR_DESKTOP_DAEMON_NODE_ID: params.daemonNodeId,
          STELLAR_DESKTOP_DAEMON_PORT: String(env.daemonPort),
          STELLAR_DESKTOP_SFTP_PORT: String(env.sftpPort),
          STELLAR_DESKTOP: "1",
        },
      }
    ) as ApiChild
    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(`[api] ${chunk.toString()}`)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(`[api] ${chunk.toString()}`)
    })
    child.on("exit", (code) => {
      console.log(`[api] exited with code ${code ?? "?"}`)
      this.child = null
    })
    this.child = child
  }

  public async stop(): Promise<void> {
    const child = this.child
    if (child === null) return
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL")
      }, 5_000)
      child.once("exit", () => {
        clearTimeout(timer)
        resolve()
      })
      child.kill("SIGTERM")
    })
  }
}
