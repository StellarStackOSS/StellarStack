import { spawn, type ChildProcessByStdio } from "node:child_process"
import fs from "node:fs"
import type { Readable } from "node:stream"

import { env } from "./env"
import { POSTGRES_URL } from "./postgres"

type ApiChild = ChildProcessByStdio<null, Readable, Readable>

/**
 * Spawns `apps/api`'s esbuild bundle as a child Node process. The API
 * needs Postgres reachable; it is the desktop app's responsibility to
 * call `ensurePostgresRunning()` before this.
 *
 * The API's env vars are minimal in desktop mode — we wire only what
 * the API actually requires, and use sensible local defaults for the
 * rest (SMTP off, no Stripe, no Redis).
 */
export class ApiProcess {
  private child: ApiChild | null = null

  public start(params: { daemonKey: string; authSecret: string }): void {
    if (this.child !== null) return
    const entry = env.apiEntrypoint
    if (!env.isDev && !fs.existsSync(entry)) {
      console.error(`[api] entrypoint missing at ${entry}`)
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

          NODE_ENV: env.isDev ? "development" : "production",
          PORT: String(env.apiPort),
          DATABASE_URL: POSTGRES_URL,

          // Single-user desktop install — match the env shape that
          // apps/api/src/env.ts expects, but stub out remote services.
          // `memory://` triggers the in-process MemoryRedis shim so we
          // skip running a Redis container.
          REDIS_URL: "memory://",
          BETTER_AUTH_SECRET: params.authSecret,
          APP_BASE_URL: `http://localhost:${String(env.apiPort)}`,
          API_BASE_URL: `http://localhost:${String(env.apiPort)}`,
          LOG_LEVEL: env.isDev ? "debug" : "info",

          // Run migrations on boot from the bundled drizzle folder.
          STELLAR_AUTO_MIGRATE_PATH: env.migrationsPath,
          // Same HMAC the daemon's TOML config has — `/setup` writes it
          // onto the local node row when the user completes onboarding.
          STELLAR_DESKTOP_DAEMON_KEY: params.daemonKey,
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
