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

  public start(): void {
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

          // Single-user desktop install — stub out the integrations the
          // API expects to be configured for the hosted product.
          REDIS_URL: "memory://", // see RedisShim wiring in api/main.ts
          SESSION_SECRET: "stellar-desktop-session-secret-change-me",
          DAEMON_SIGNING_SECRET: "stellar-desktop-daemon-secret-change-me",
          PANEL_URL: `http://localhost:${String(env.apiPort)}`,
          APP_BASE_URL: `http://localhost:${String(env.apiPort)}`,
          SMTP_HOST: "",
          SMTP_FROM: "noreply@localhost",
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
