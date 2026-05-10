import path from "node:path"

import {
  BrowserWindow,
  app,
  ipcMain,
  protocol,
  shell,
} from "electron"

import { ApiProcess } from "./api"
import { DaemonProcess } from "./daemon"
import { checkDocker, dockerInstallUrl } from "./docker"
import { env } from "./env"
import { ensurePostgresRunning } from "./postgres"

// ---------------------------------------------------------------------------
// Single-instance lock.
//
// AMP-style desktop apps can corrupt their SQLite store if two copies are
// open at once. We claim a process-level lock on launch; the second copy
// quits and focuses the existing window.
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

const api = new ApiProcess()
const daemon = new DaemonProcess()
let mainWindow: BrowserWindow | null = null

// In production, register a `stellar://` custom protocol that serves the
// bundled `apps/web/dist`. This sidesteps file:// CORS quirks and gives
// the renderer a stable origin for things like service workers.
const registerPanelProtocol = () => {
  protocol.registerFileProtocol("stellar", (request, callback) => {
    const url = request.url.replace(/^stellar:\/\/panel\//, "")
    callback({
      path: path.join(env.panelDistPath, url === "" ? "index.html" : url),
    })
  })
}

const createBootstrapWindow = (): BrowserWindow => {
  // The bootstrap window is a tiny native window we open before launching
  // the panel. It runs the Docker check and, if needed, walks the user
  // through installing it. Once Docker is reachable we close it and open
  // the main panel window.
  const win = new BrowserWindow({
    width: 480,
    height: 540,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "StellarStack",
    backgroundColor: "#120F0C",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.removeMenu()
  void win.loadFile(path.join(__dirname, "../bootstrap/index.html"))
  return win
}

const createMainWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "StellarStack",
    backgroundColor: "#120F0C",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (env.isDev) {
    void win.loadURL(env.panelUrl)
    win.webContents.openDevTools({ mode: "detach" })
  } else {
    void win.loadURL(env.panelUrl)
  }
  // External links open in the system browser, not in our window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })
  return win
}

const launchPanel = () => {
  if (mainWindow !== null) {
    mainWindow.focus()
    return
  }
  api.start()
  daemon.start()
  mainWindow = createMainWindow()
  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ---------------------------------------------------------------------------
// IPC — the bootstrap window calls these to drive the Docker check and to
// hand off to the main panel window once Docker is up.
// ---------------------------------------------------------------------------

ipcMain.handle("docker:check", async () => checkDocker())
ipcMain.handle("docker:install-url", () => dockerInstallUrl())
ipcMain.handle("docker:open-install-page", () => {
  void shell.openExternal(dockerInstallUrl())
})

// Run after the Docker check passes. Pulls + starts a Postgres container
// (idempotent), then loads the panel. The renderer streams progress
// updates back via `bootstrap:status` events.
ipcMain.handle("bootstrap:ensure-postgres", async (event) => {
  const sender = event.sender
  const onStatus = (msg: string) => {
    if (!sender.isDestroyed()) sender.send("bootstrap:status", msg)
  }
  await ensurePostgresRunning(onStatus)
})

ipcMain.handle("panel:launch", () => {
  launchPanel()
  // Close the bootstrap window — fromWebContents is the safest way to find
  // the window the renderer is actually in.
  for (const win of BrowserWindow.getAllWindows()) {
    if (win !== mainWindow && !win.isDestroyed()) win.close()
  }
})

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
