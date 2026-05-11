import fs from "node:fs"
import path from "node:path"

import { app } from "electron"

// Per-process append-mode log files under the userData directory. Two
// goals:
//
//   1. Stream every interesting event to the bootstrap window so the
//      user can see what's happening behind "Checking…" rather than
//      staring at a spinner.
//   2. Persist everything to a file so when a user reports a bug they
//      can zip up `~/Library/Application Support/StellarStack/logs/`
//      and attach it.
//
// The store is split per concern: bootstrap.log (own log), api.log
// (stdio from the API sidecar), daemon.log (stdio from the daemon).

const dir = (): string => {
  const d = path.join(app.getPath("userData"), "logs")
  fs.mkdirSync(d, { recursive: true })
  return d
}

export const logsDirectory = (): string => dir()

/**
 * Open an append-mode write stream for `${name}.log`. The first call to
 * `openLog("api")` truncates the file to ~1 MB if it's grown beyond
 * that on prior runs so the disk footprint stays bounded.
 */
export const openLog = (name: string): fs.WriteStream => {
  const file = path.join(dir(), `${name}.log`)
  try {
    const stat = fs.statSync(file)
    if (stat.size > 1_000_000) {
      fs.renameSync(file, `${file}.prev`)
    }
  } catch {
    // file doesn't exist yet
  }
  return fs.createWriteStream(file, { flags: "a" })
}

// A single bootstrap-scoped logger reused for the whole startup
// sequence (docker check + infra bring-up + api spawn + setup poll).
// The main process holds the stream open for the app lifetime; the
// renderer subscribes to events via `bootstrap:log` IPC.

let bootstrapStream: fs.WriteStream | null = null

const stamp = (): string => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const ss = String(now.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export type LogLevel = "info" | "warn" | "error"

/** Append a line to bootstrap.log. Returns the rendered line so callers
 *  can also forward it to IPC. */
export const logBootstrap = (level: LogLevel, message: string): string => {
  if (bootstrapStream === null) bootstrapStream = openLog("bootstrap")
  const line = `[${stamp()}] ${level.toUpperCase().padEnd(5)} ${message}`
  bootstrapStream.write(`${line}\n`)
  return line
}
