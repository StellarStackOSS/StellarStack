import { contextBridge, ipcRenderer } from "electron"

// Surface a tiny, typed IPC shim to the renderer instead of exposing
// `ipcRenderer` itself — that keeps `nodeIntegration: false` honest and
// stops the panel from doing anything we didn't intend.

type DockerStatus =
  | { kind: "ok"; version: string }
  | { kind: "missing" }
  | { kind: "not-running" }

const api = {
  docker: {
    check: () => ipcRenderer.invoke("docker:check") as Promise<DockerStatus>,
    installUrl: () =>
      ipcRenderer.invoke("docker:install-url") as Promise<string>,
    openInstallPage: () =>
      ipcRenderer.invoke("docker:open-install-page") as Promise<void>,
  },
  bootstrap: {
    ensurePostgres: () =>
      ipcRenderer.invoke("bootstrap:ensure-postgres") as Promise<void>,
    onStatus: (cb: (msg: string) => void): (() => void) => {
      const handler = (_e: unknown, msg: string) => cb(msg)
      ipcRenderer.on("bootstrap:status", handler)
      return () => {
        ipcRenderer.removeListener("bootstrap:status", handler)
      }
    },
  },
  panel: {
    launch: () => ipcRenderer.invoke("panel:launch") as Promise<void>,
  },
} as const

contextBridge.exposeInMainWorld("stellar", api)

declare global {
  interface Window {
    stellar: typeof api
  }
}
