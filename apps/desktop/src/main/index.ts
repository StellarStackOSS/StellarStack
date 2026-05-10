import { randomBytes } from "node:crypto"
import path from "node:path"

import {
  BrowserWindow,
  app,
  ipcMain,
  protocol,
  shell,
  session,
} from "electron"

import { ApiProcess } from "./api"
import { DaemonProcess } from "./daemon"
import { checkDocker, dockerInstallUrl } from "./docker"
import { env } from "./env"
import { ensurePostgresRunning } from "./postgres"
import {
  getOrCreateDaemonKey,
  isSetupCompleted,
  markSetupCompleted,
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
// `electron-store`; the same values are reused across every subsequent
// launch so the API + daemon agree on signing.
const daemonKey = getOrCreateDaemonKey()
const authSecret = (() => {
  // BETTER_AUTH_SECRET ≥ 16 chars; 32 random bytes hex is plenty.
  // Stored on the same store-backed file as the daemon key.
  return randomBytes(32).toString("hex")
})()

const api = new ApiProcess()
const daemon = new DaemonProcess()
let mainWindow: BrowserWindow | null = null
const apiOrigin = `http://localhost:${String(env.apiPort)}`

// ---------------------------------------------------------------------------
// Static asset protocol for the bundled panel UI.
// ---------------------------------------------------------------------------

const registerPanelProtocol = () => {
  protocol.registerFileProtocol("stellar", (request, callback) => {
    const url = request.url.replace(/^stellar:\/\/panel\//, "")
    callback({
      path: path.join(env.panelDistPath, url === "" ? "index.html" : url),
    })
  })
}

// ---------------------------------------------------------------------------
// Window factories.
// ---------------------------------------------------------------------------

const baseWebPreferences = {
  preload: path.join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
}

const createSmallWindow = (file: string): BrowserWindow => {
  const win = new BrowserWindow({
    width: 480,
    height: 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "StellarStack",
    backgroundColor: "#120F0C",
    webPreferences: baseWebPreferences,
  })
  win.removeMenu()
  void win.loadFile(path.join(__dirname, file))
  return win
}

const createBootstrapWindow = () =>
  createSmallWindow("../bootstrap/index.html")

const createOnboardingWindow = () =>
  createSmallWindow("../onboarding/index.html")

const createMainWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "StellarStack",
    backgroundColor: "#120F0C",
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
  api.start({ daemonKey, authSecret })
  apiStarted = true
}

let daemonStarted = false
const startDaemonOnce = () => {
  if (daemonStarted) return
  daemon.start({ hmacKey: daemonKey })
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

const launchPanel = () => {
  if (mainWindow !== null) {
    mainWindow.focus()
    return
  }
  startDaemonOnce()
  mainWindow = createMainWindow()
  mainWindow.on("closed", () => {
    mainWindow = null
  })
  closeWindowsExcept(mainWindow)
}

// ---------------------------------------------------------------------------
// IPC.
// ---------------------------------------------------------------------------

ipcMain.handle("docker:check", async () => checkDocker())
ipcMain.handle("docker:install-url", () => dockerInstallUrl())
ipcMain.handle("docker:open-install-page", () => {
  void shell.openExternal(dockerInstallUrl())
})

// Bootstrap → Postgres → API → branch on whether onboarding is needed.
ipcMain.handle("bootstrap:ensure-postgres", async (event) => {
  const sender = event.sender
  const onStatus = (msg: string) => {
    if (!sender.isDestroyed()) sender.send("bootstrap:status", msg)
  }
  await ensurePostgresRunning(onStatus)
  onStatus("Starting API…")
  startApiOnce()
  const status = await waitForApi()
  if (status.needsSetup) {
    // Hand off to onboarding instead of the panel. The bootstrap window
    // is closed once the new one is open.
    const onboarding = createOnboardingWindow()
    closeWindowsExcept(onboarding)
  } else {
    launchPanel()
  }
})

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
    for (const raw of rawCookies) {
      await applyCookie(raw)
    }
    markSetupCompleted()
    launchPanel()
  }
)

ipcMain.handle("panel:launch", () => {
  launchPanel()
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
  await session.defaultSession.cookies.set({
    url: apiOrigin,
    name,
    value,
    path: typeof flags["path"] === "string" ? flags["path"] : "/",
    httpOnly: flags["httponly"] === true,
    secure: false,
    sameSite:
      flags["samesite"] === "Lax" || flags["samesite"] === "lax"
        ? "lax"
        : "no_restriction",
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

app.whenReady().then(() => {
  if (!env.isDev) registerPanelProtocol()
  // First-time vs returning is a hint, not a source of truth — the API's
  // /api/setup response wins. The hint just lets us skip the bootstrap
  // window's progress messaging if we know we won't need to onboard.
  if (isSetupCompleted()) {
    // Same flow as a returning launch — bootstrap still ensures Docker
    // + Postgres are alive before letting the panel open.
  }
  createBootstrapWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createBootstrapWindow()
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
  await Promise.allSettled([api.stop(), daemon.stop()])
  app.exit(0)
})
