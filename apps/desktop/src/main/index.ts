import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  BrowserWindow,
  app,
  ipcMain,
  net,
  protocol,
  shell,
  session,
} from "electron"

// Electron requires custom schemes to be registered as privileged BEFORE
// app.whenReady fires. We register `stellar://` as standard + secure +
// supports-fetch so the panel's ESM imports + `fetch` resolve correctly.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "stellar",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

import { ApiProcess } from "./api"
import { DaemonProcess } from "./daemon"
import { dockerInstallUrl, scanDocker } from "./docker"
import { env } from "./env"
import { ensureInfraRunning, type InfraTarget } from "./infra"
import { type LogLevel, logBootstrap, logsDirectory } from "./logs"
import { augmentPath, type DockerInstance } from "./path"
import { startWebDevServer, stopWebDevServer } from "./web-dev"

// Electron on macOS / Windows launched from the OS shell inherits a
// stripped-down PATH that doesn't include `/opt/homebrew/bin`,
// `/usr/local/bin`, Docker Desktop's bundle dir, Colima's bin, etc.
// Patch it before any child process spawns so `docker` is findable.
augmentPath()
import {
  getDockerInstanceId,
  getOrCreateAuthSecret,
  getOrCreateDaemonKey,
  getOrCreateDaemonNodeId,
  isSetupCompleted,
  markSetupCompleted,
  setDockerInstanceId,
} from "./secrets"

// ---------------------------------------------------------------------------
// Single-instance lock.
//
// AMP-style desktop apps can corrupt their state if two copies are open
// at once. We claim a process-level lock on launch; the second copy
// quits and focuses the existing window.
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// Per-install secrets. Generated on first ever launch and persisted to
// `stellar-secrets.json`; the same values are reused across every
// subsequent launch so the API + daemon agree on signing and the
// user's session survives a relaunch.
const daemonKey = getOrCreateDaemonKey()
const daemonNodeId = getOrCreateDaemonNodeId()
const authSecret = getOrCreateAuthSecret()

const api = new ApiProcess()
const daemon = new DaemonProcess()
let mainWindow: BrowserWindow | null = null
const apiOrigin = `http://localhost:${String(env.apiPort)}`

// ---------------------------------------------------------------------------
// Static asset protocol for the bundled panel UI.
// ---------------------------------------------------------------------------

const registerPanelProtocol = () => {
  protocol.handle("stellar", async (request) => {
    const url = new URL(request.url)
    // stellar://panel/index.html → "index.html"; stellar://panel/ → "index.html"
    let relative = url.pathname.replace(/^\//, "")
    if (relative === "" || relative.endsWith("/")) relative += "index.html"
    const filePath = path.join(env.panelDistPath, relative)
    // Block path traversal outside the panel dist root.
    const resolved = path.resolve(filePath)
    const root = path.resolve(env.panelDistPath)
    if (!resolved.startsWith(root)) {
      return new Response("Forbidden", { status: 403 })
    }
    if (!fs.existsSync(resolved)) {
      // SPA fallback for client-side routes — serve index.html so the
      // hash router can take over instead of returning 404.
      const fallback = path.join(root, "index.html")
      return net.fetch(pathToFileURL(fallback).toString())
    }
    return net.fetch(pathToFileURL(resolved).toString())
  })
}

// ---------------------------------------------------------------------------
// Window factories.
// ---------------------------------------------------------------------------

const baseWebPreferences = {
  preload: path.join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  devTools: true,
}

// Register a global Cmd/Ctrl+Shift+I shortcut to toggle devtools on
// whichever Electron window is focused. Useful for production builds
// where there's no menu bar with a "View → Toggle Developer Tools"
// entry. Wired up below in app.whenReady.
const installDevtoolsShortcut = () => {
  const toggle = () => {
    const focused = BrowserWindow.getFocusedWindow()
    if (focused === null) return
    if (focused.webContents.isDevToolsOpened()) {
      focused.webContents.closeDevTools()
    } else {
      focused.webContents.openDevTools({ mode: "detach" })
    }
  }
  // Lazy-require to avoid pulling globalShortcut into the wider module
  // graph at module-evaluation time (it needs app to be ready).
  const { globalShortcut } = require("electron") as typeof import("electron")
  globalShortcut.register("CommandOrControl+Shift+I", toggle)
  globalShortcut.register("CommandOrControl+Alt+I", toggle)
}

const createSmallWindow = (
  file: string,
  options: { width?: number; height?: number } = {}
): BrowserWindow => {
  const isMac = process.platform === "darwin"
  const win = new BrowserWindow({
    width: options.width ?? 480,
    height: options.height ?? 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "StellarStack",
    backgroundColor: "#120F0C",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
    titleBarOverlay: isMac
      ? undefined
      : { color: "#120F0C", symbolColor: "#f5f5f5", height: 36 },
    webPreferences: baseWebPreferences,
  })
  win.removeMenu()
  void win.loadFile(path.join(__dirname, file))
  return win
}

const createBootstrapWindow = () =>
  createSmallWindow("../bootstrap/index.html", { width: 520, height: 720 })

const createOnboardingWindow = () =>
  createSmallWindow("../onboarding/index.html")

const createMainWindow = async (): Promise<BrowserWindow> => {
  console.log("[panel] createMainWindow: waiting for web server")
  await startWebDevServer()
  console.log(`[panel] createMainWindow: opening ${env.panelUrl}`)
  const isMac = process.platform === "darwin"
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "StellarStack",
    backgroundColor: "#201c19",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
    titleBarOverlay: isMac
      ? undefined
      : { color: "#201c19", symbolColor: "#f5f5f5", height: 36 },
    webPreferences: baseWebPreferences,
  })
  void win.loadURL(env.panelUrl)
  if (env.isDev) win.webContents.openDevTools({ mode: "detach" })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })
  return win
}

// ---------------------------------------------------------------------------
// Lifecycle helpers.
// ---------------------------------------------------------------------------

let apiStarted = false
const startApiOnce = () => {
  if (apiStarted) return
  api.start({ daemonKey, daemonNodeId, authSecret })
  apiStarted = true
}

let daemonStarted = false
const startDaemonOnce = () => {
  if (daemonStarted) return
  daemon.start({
    hmacKey: daemonKey,
    nodeId: daemonNodeId,
    apiBaseUrl: apiOrigin,
  })
  daemonStarted = true
}

const closeWindowsExcept = (keep: BrowserWindow | null) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win !== keep && !win.isDestroyed()) win.close()
  }
}

/**
 * Poll the API until it answers `/api/setup`. The API has to apply
 * migrations + boot Hono before it can respond, which on a cold first
 * launch can take 5–10s. We give it 30s before giving up.
 */
const waitForApi = async (): Promise<{ needsSetup: boolean }> => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiOrigin}/api/setup`)
      if (res.ok) {
        return (await res.json()) as { needsSetup: boolean }
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("API didn't come up within 30s")
}

const launchPanel = async (): Promise<void> => {
  if (mainWindow !== null) {
    mainWindow.focus()
    return
  }
  startDaemonOnce()
  const win = await createMainWindow()
  mainWindow = win
  win.on("closed", () => {
    mainWindow = null
  })
  closeWindowsExcept(win)
}

// ---------------------------------------------------------------------------
// IPC.
// ---------------------------------------------------------------------------

// Broadcast a log line to every bootstrap/onboarding window so the user
// sees the same stream the file is collecting. The renderer subscribes
// via `window.stellar.bootstrap.onLog`.
const emitLog = (level: LogLevel, message: string) => {
  const line = logBootstrap(level, message)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win !== mainWindow) {
      win.webContents.send("bootstrap:log", { level, line })
    }
  }
}

// Hold the result of the last `docker:scan` in memory so subsequent
// `bootstrap:ensure-infra` calls can use the user's pick without
// re-scanning (the scan can take a second or two on first run).
let lastScan: {
  binary: string | null
  instances: DockerInstance[]
} | null = null

ipcMain.handle("docker:scan", async () => {
  const result = await scanDocker((level, msg) =>
    emitLog(level, `[docker] ${msg}`)
  )
  lastScan = { binary: result.binary, instances: result.instances }
  // Honour any previously stored pick, falling back to the auto-default.
  const stored = getDockerInstanceId()
  const storedStillRunning =
    stored !== null &&
    result.instances.some((i) => i.id === stored && i.running)
  return {
    binary: result.binary,
    instances: result.instances,
    selectedId: storedStillRunning ? stored : result.defaultId,
  }
})
ipcMain.handle("docker:install-url", () => dockerInstallUrl())
ipcMain.handle("docker:open-install-page", () => {
  void shell.openExternal(dockerInstallUrl())
})
ipcMain.handle("logs:open-directory", () => {
  void shell.openPath(logsDirectory())
})

// Bootstrap pipeline:
//   Docker present → Postgres + Redis containers up → API spawn → poll
//   /api/setup → branch on whether onboarding is needed.
//
// This whole sequence runs on every launch (not just first time). The
// container ensures are idempotent — `docker start` on an already-running
// container is a no-op, so if the user reboots their PC and Docker
// auto-starts the two containers, we just confirm they're alive and
// move on.
ipcMain.handle(
  "bootstrap:ensure-infra",
  async (event, args: { instanceId: string }) => {
    if (lastScan === null || lastScan.binary === null) {
      throw new Error("Run docker:scan first")
    }
    const instance = lastScan.instances.find((i) => i.id === args.instanceId)
    if (instance === undefined) {
      throw new Error(`Unknown Docker instance id: ${args.instanceId}`)
    }
    if (!instance.running) {
      throw new Error(
        `${instance.label} isn't running. Start it, then try again.`
      )
    }
    setDockerInstanceId(instance.id)
    const target: InfraTarget = {
      binary: lastScan.binary,
      dockerHost: instance.dockerHost,
    }
    emitLog(
      "info",
      `[infra] Using ${instance.label} (${instance.dockerHost})`
    )

    const sender = event.sender
    const onStatus = (msg: string) => {
      if (!sender.isDestroyed()) sender.send("bootstrap:status", msg)
      emitLog("info", `[infra] ${msg}`)
    }
    try {
      await ensureInfraRunning(target, onStatus)
    } catch (err) {
      emitLog(
        "error",
        `[infra] ${err instanceof Error ? err.message : String(err)}`
      )
      throw err
    }
    onStatus("Starting API…")
    startApiOnce()
    const status = await waitForApi()
    emitLog(
      "info",
      `[api] /api/setup responded; needsSetup=${String(status.needsSetup)}`
    )
    if (status.needsSetup) {
      const onboarding = createOnboardingWindow()
      closeWindowsExcept(onboarding)
    } else {
      onStatus("Opening panel…")
      await launchPanel()
    }
  }
)

// Onboarding → POST /api/setup → forward better-auth's session cookie
// onto the BrowserWindow's session so the panel boots signed-in.
ipcMain.handle(
  "onboarding:complete",
  async (
    _event,
    body: { displayName: string; email: string; password: string }
  ) => {
    const res = await fetch(`${apiOrigin}/api/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Setup failed (${String(res.status)}): ${text}`)
    }
    // Pull the Set-Cookie header(s) and inject them into Electron's
    // default session so the panel window inherits the better-auth
    // session token. Without this the panel would land on its sign-in
    // screen even though we just created the user.
    const rawCookies = res.headers.getSetCookie?.() ?? []
    console.log(`[onboarding] forwarding ${String(rawCookies.length)} cookies from /api/setup`)
    for (const raw of rawCookies) {
      console.log(`[onboarding] applying cookie: ${raw}`)
      await applyCookie(raw)
    }
    const stored = await session.defaultSession.cookies.get({ url: apiOrigin })
    console.log(`[onboarding] cookies in jar for ${apiOrigin}:`, stored.map((c) => c.name))
    markSetupCompleted()
    await launchPanel()
  }
)

ipcMain.handle("panel:launch", async () => {
  await launchPanel()
})

/**
 * Parse a single Set-Cookie line and forward it to Electron's cookie jar.
 * better-auth emits HttpOnly cookies, so the renderer can't see them but
 * the cookie jar still includes them on requests to the same origin.
 */
const applyCookie = async (raw: string): Promise<void> => {
  // Format: `name=value; Path=/; HttpOnly; SameSite=Lax`
  const [pair, ...attrs] = raw.split(";")
  if (pair === undefined) return
  const eq = pair.indexOf("=")
  if (eq < 0) return
  const name = pair.slice(0, eq).trim()
  const value = pair.slice(eq + 1).trim()
  const flags: Record<string, string | true> = {}
  for (const a of attrs) {
    const [k, ...rest] = a.trim().split("=")
    if (k === undefined || k === "") continue
    flags[k.toLowerCase()] = rest.length > 0 ? rest.join("=") : true
  }
  // Force SameSite=None equivalent ("no_restriction") so the cookie is
  // included on cross-origin fetches from stellar://panel → localhost
  // :18080. Better-auth emits Lax by default which Chromium drops on
  // cross-site subresource requests, leaving /auth/get-session as 401.
  // secure:false is fine because the URL is plain http (localhost).
  await session.defaultSession.cookies.set({
    url: apiOrigin,
    name,
    value,
    path: typeof flags["path"] === "string" ? flags["path"] : "/",
    httpOnly: flags["httponly"] === true,
    secure: false,
    sameSite: "no_restriction",
  })
}

// ---------------------------------------------------------------------------
// App lifecycle.
// ---------------------------------------------------------------------------

app.on("second-instance", () => {
  if (mainWindow !== null) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// Fast-path: when the user has completed setup before AND the Docker
// instance they picked is still running AND infra containers come up
// clean, skip the bootstrap window entirely. We do this headlessly in
// the main process so users with a working install never see the setup
// wizard. Any failure → fall back to the bootstrap UI which has the
// detailed log panel + rescan buttons.
const tryHeadlessBootAndLaunchPanel = async (): Promise<boolean> => {
  if (!isSetupCompleted()) return false
  const savedId = getDockerInstanceId()
  if (savedId === null) return false
  try {
    const scan = await scanDocker(() => {})
    lastScan = scan
    if (scan.binary === null) return false
    const instance = scan.instances.find((i) => i.id === savedId)
    if (instance === undefined || !instance.running) return false
    const target: InfraTarget = {
      binary: scan.binary,
      dockerHost: instance.dockerHost,
    }
    await ensureInfraRunning(target, () => {})
    startApiOnce()
    await waitForApi()
    await launchPanel()
    return true
  } catch (err) {
    console.error("[bootstrap] headless boot failed; falling back:", err)
    return false
  }
}

app.whenReady().then(async () => {
  if (!env.isDev) registerPanelProtocol()
  installDevtoolsShortcut()
  // Start Vite in parallel with the bootstrap check in dev so the panel
  // window can open immediately once it's ready.
  void startWebDevServer().catch((err: unknown) => {
    console.error("[web] failed to start:", err)
  })

  const skippedBootstrap = await tryHeadlessBootAndLaunchPanel()
  if (!skippedBootstrap) createBootstrapWindow()

  app.on("activate", () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      return
    }
    if (BrowserWindow.getAllWindows().length > 0) return
    void (async () => {
      const ok = await tryHeadlessBootAndLaunchPanel()
      if (!ok) createBootstrapWindow()
    })()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Stop the sidecars on quit. Postgres stays in its container — it's
// `--restart unless-stopped` so it'll be ready next launch.
let shuttingDown = false
app.on("before-quit", async (e) => {
  if (shuttingDown) return
  shuttingDown = true
  e.preventDefault()
  stopWebDevServer()
  await Promise.allSettled([api.stop(), daemon.stop()])
  app.exit(0)
})
