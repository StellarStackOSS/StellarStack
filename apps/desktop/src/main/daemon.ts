import {
  spawn,
  type ChildProcessByStdio,
} from "node:child_process"
import fs from "node:fs"
import type { Readable } from "node:stream"

import { env } from "./env"

type DaemonChild = ChildProcessByStdio<null, Readable, Readable>

/**
 * Wraps the StellarStack daemon as a child process. The daemon owns the
 * Docker socket and exposes the per-server WebSocket on a local port.
 *
 * In a packaged build the binary lives at `resources/stellar-daemon`
 * (electron-builder copies it from the workspace). In dev we expect the
 * developer to have run `go build` inside `apps/daemon` and to have the
 * binary available — `pnpm dev` will warn loudly if it's missing.
 */
export class DaemonProcess {
  private child: DaemonChild | null = null

  public start(): void {
    if (this.child !== null) return
    const binary = env.daemonBinaryPath
    if (!env.isDev && !fs.existsSync(binary)) {
      console.error(`[daemon] binary missing at ${binary}`)
      return
    }
    const child = spawn(
      binary,
      ["serve", "--config", `${env.dataDir}/daemon.toml`],
      {
        cwd: env.dataDir,
        stdio: ["ignore", "pipe", "pipe"] as const,
        env: { ...process.env, STELLAR_DESKTOP: "1" },
      }
    ) as DaemonChild
    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(`[daemon] ${chunk.toString()}`)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(`[daemon] ${chunk.toString()}`)
    })
    child.on("exit", (code) => {
      console.log(`[daemon] exited with code ${code ?? "?"}`)
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
