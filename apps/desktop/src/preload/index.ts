import { contextBridge, ipcRenderer } from "electron"

// Surface a tiny, typed IPC shim to the renderer instead of exposing
// `ipcRenderer` itself — that keeps `nodeIntegration: false` honest and
// stops the panel from doing anything we didn't intend.

type DockerRuntime =
  | "docker-desktop"
  | "colima"
  | "orbstack"
  | "rancher-desktop"
  | "podman"
  | "docker-engine"
  | "env"
  | "unknown"

type DockerInstance = {
  id: string
  label: string
  runtime: DockerRuntime
  socket: string
  dockerHost: string
  present: boolean
  running: boolean
  version?: string
}

type DockerScanResult = {
  binary: string | null
  instances: DockerInstance[]
  selectedId: string | null
}

const API_PORT = 18080
const apiUrl = `http://localhost:${String(API_PORT)}`
const wsUrl = `ws://localhost:${String(API_PORT)}`

const api = {
  apiUrl,
  wsUrl,
  desktop: true as const,
  platform: process.platform,
  docker: {
    scan: () => ipcRenderer.invoke("docker:scan") as Promise<DockerScanResult>,
    installUrl: () =>
      ipcRenderer.invoke("docker:install-url") as Promise<string>,
    openInstallPage: () =>
      ipcRenderer.invoke("docker:open-install-page") as Promise<void>,
  },
  bootstrap: {
    ensureInfra: (args: { instanceId: string }) =>
      ipcRenderer.invoke("bootstrap:ensure-infra", args) as Promise<void>,
    onStatus: (cb: (msg: string) => void): (() => void) => {
      const handler = (_e: unknown, msg: string) => cb(msg)
      ipcRenderer.on("bootstrap:status", handler)
      return () => {
        ipcRenderer.removeListener("bootstrap:status", handler)
      }
    },
    onLog: (
      cb: (entry: { level: "info" | "warn" | "error"; line: string }) => void
    ): (() => void) => {
      const handler = (
        _e: unknown,
        entry: { level: "info" | "warn" | "error"; line: string }
      ) => cb(entry)
      ipcRenderer.on("bootstrap:log", handler)
      return () => {
        ipcRenderer.removeListener("bootstrap:log", handler)
      }
    },
  },
  logs: {
    openDirectory: () =>
      ipcRenderer.invoke("logs:open-directory") as Promise<void>,
  },
  panel: {
    launch: () => ipcRenderer.invoke("panel:launch") as Promise<void>,
  },
  onboarding: {
    complete: (input: {
      displayName: string
      email: string
      password: string
    }) =>
      ipcRenderer.invoke("onboarding:complete", input) as Promise<void>,
  },
} as const

contextBridge.exposeInMainWorld("stellar", api)

declare global {
  interface Window {
    stellar: typeof api
  }
}
