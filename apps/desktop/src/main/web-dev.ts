import { spawn, type ChildProcess } from "node:child_process"
import net from "node:net"
import path from "node:path"

import { env } from "./env"

const VITE_PORT = 5173

const tryHost = (port: number, host: string): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once("connect", () => {
      socket.end()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })

const isPortListening = async (port: number): Promise<boolean> => {
  if (await tryHost(port, "127.0.0.1")) return true
  if (await tryHost(port, "::1")) return true
  return false
}

const waitForPort = async (port: number, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isPortListening(port)) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Vite dev server didn't open ${String(port)} within ${String(timeoutMs)}ms`)
}

let child: ChildProcess | null = null
let startPromise: Promise<void> | null = null

export const startWebDevServer = (): Promise<void> => {
  if (!env.isDev) return Promise.resolve()
  if (startPromise !== null) return startPromise
  startPromise = (async () => {
    if (await isPortListening(VITE_PORT)) {
      console.log("[web] port 5173 already listening; reusing")
      return
    }
    const repoRoot = path.resolve(__dirname, "../../../..")
    console.log(`[web] spawning vite from ${repoRoot}`)
    child = spawn("pnpm", ["--filter", "web", "dev"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    })
    child.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(`[web] ${chunk.toString()}`)
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(`[web] ${chunk.toString()}`)
    })
    child.on("exit", (code) => {
      console.log(`[web] exited with code ${code ?? "?"}`)
      child = null
      startPromise = null
    })
    await waitForPort(VITE_PORT, 30_000)
  })()
  return startPromise
}

export const stopWebDevServer = (): void => {
  if (child === null) return
  child.kill("SIGTERM")
  child = null
}
