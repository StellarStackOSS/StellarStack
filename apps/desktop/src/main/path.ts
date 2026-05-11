import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// PATH augmentation — Electron launched from Finder/Dock inherits the
// GUI's PATH, which on macOS is roughly `/usr/bin:/bin:/usr/sbin:/sbin`.
// None of the popular Docker installs (Docker Desktop, Homebrew, Colima,
// OrbStack, Rancher Desktop, Podman) drop binaries in those dirs. We
// patch `process.env.PATH` once at startup so every child process the
// app spawns can find the docker CLI.
// ---------------------------------------------------------------------------

const macOsBinDirs = (home: string): string[] => [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/Applications/Docker.app/Contents/Resources/bin",
  path.join(home, ".docker/bin"),
  path.join(home, ".colima/bin"),
  path.join(home, ".orbstack/bin"),
  path.join(home, ".rd/bin"),
  "/opt/podman/bin",
]

const linuxBinDirs = (home: string): string[] => [
  "/usr/local/bin",
  "/usr/bin",
  "/snap/bin",
  path.join(home, ".local/bin"),
  path.join(home, ".docker/bin"),
]

const windowsBinDirs = (): string[] => [
  "C:\\Program Files\\Docker\\Docker\\resources\\bin",
  "C:\\Program Files\\Docker\\Docker\\resources\\cli-plugins",
  "C:\\Program Files\\Podman\\bin",
  "C:\\ProgramData\\chocolatey\\bin",
]

const binDirsForPlatform = (): string[] => {
  const home = os.homedir()
  switch (process.platform) {
    case "darwin":
      return macOsBinDirs(home)
    case "win32":
      return windowsBinDirs()
    default:
      return linuxBinDirs(home)
  }
}

export const augmentPath = (): void => {
  const sep = process.platform === "win32" ? ";" : ":"
  const current = (process.env["PATH"] ?? "").split(sep).filter((s) => s !== "")
  const seen = new Set(current)
  for (const dir of binDirsForPlatform()) {
    if (existsSync(dir) && !seen.has(dir)) {
      current.push(dir)
      seen.add(dir)
    }
  }
  process.env["PATH"] = current.join(sep)
}

const findDockerBinary = (): string | null => {
  const binaryName = process.platform === "win32" ? "docker.exe" : "docker"
  const sep = process.platform === "win32" ? ";" : ":"
  const dirs = [
    ...(process.env["PATH"] ?? "").split(sep),
    ...binDirsForPlatform(),
  ]
  for (const dir of dirs) {
    if (dir === "") continue
    const candidate = path.join(dir, binaryName)
    if (existsSync(candidate)) return candidate
  }
  return null
}

// ---------------------------------------------------------------------------
// Daemon socket enumeration — IntelliJ-style discovery.
//
// Each entry below is a *candidate* socket. We check whether it exists
// on disk, then probe it with `docker --host <url> version` to confirm
// the engine behind it is actually responsive. Found-and-running ones
// get presented to the user in a dropdown.
// ---------------------------------------------------------------------------

export type DockerRuntime =
  | "docker-desktop"
  | "colima"
  | "orbstack"
  | "rancher-desktop"
  | "podman"
  | "docker-engine"
  | "env"
  | "unknown"

export type DockerInstance = {
  /** Stable id we persist when the user picks one of these. */
  id: string
  /** Pretty label for the dropdown ("Docker Desktop", "Colima default"). */
  label: string
  runtime: DockerRuntime
  /** Filesystem path of the unix socket (no `unix://` prefix). */
  socket: string
  /** Docker host URL in the form the CLI understands. */
  dockerHost: string
  /** True if the socket exists on disk right now. */
  present: boolean
  /** True if `docker --host … version` returned a server version. */
  running: boolean
  /** Server version reported by the engine, if running. */
  version?: string
}

const macOsSocketCandidates = (home: string): Omit<
  DockerInstance,
  "present" | "running" | "version"
>[] => [
  {
    id: "docker-desktop",
    label: "Docker Desktop",
    runtime: "docker-desktop",
    socket: path.join(home, ".docker/run/docker.sock"),
    dockerHost: `unix://${path.join(home, ".docker/run/docker.sock")}`,
  },
  {
    id: "docker-desktop-system",
    label: "Docker (/var/run)",
    runtime: "docker-desktop",
    socket: "/var/run/docker.sock",
    dockerHost: "unix:///var/run/docker.sock",
  },
  {
    id: "colima-default",
    label: "Colima — default",
    runtime: "colima",
    socket: path.join(home, ".colima/default/docker.sock"),
    dockerHost: `unix://${path.join(home, ".colima/default/docker.sock")}`,
  },
  {
    id: "orbstack",
    label: "OrbStack",
    runtime: "orbstack",
    socket: path.join(home, ".orbstack/run/docker.sock"),
    dockerHost: `unix://${path.join(home, ".orbstack/run/docker.sock")}`,
  },
  {
    id: "rancher-desktop",
    label: "Rancher Desktop",
    runtime: "rancher-desktop",
    socket: path.join(home, ".rd/docker.sock"),
    dockerHost: `unix://${path.join(home, ".rd/docker.sock")}`,
  },
  {
    id: "podman",
    label: "Podman",
    runtime: "podman",
    socket: path.join(home, ".local/share/containers/podman/machine/podman.sock"),
    dockerHost: `unix://${path.join(home, ".local/share/containers/podman/machine/podman.sock")}`,
  },
]

const linuxSocketCandidates = (home: string): Omit<
  DockerInstance,
  "present" | "running" | "version"
>[] => [
  {
    id: "docker-engine",
    label: "Docker (/var/run)",
    runtime: "docker-engine",
    socket: "/var/run/docker.sock",
    dockerHost: "unix:///var/run/docker.sock",
  },
  {
    id: "podman",
    label: "Podman",
    runtime: "podman",
    socket: `/run/user/${String(process.getuid?.() ?? 1000)}/podman/podman.sock`,
    dockerHost: `unix:///run/user/${String(process.getuid?.() ?? 1000)}/podman/podman.sock`,
  },
  {
    id: "podman-rootful",
    label: "Podman (rootful)",
    runtime: "podman",
    socket: "/run/podman/podman.sock",
    dockerHost: "unix:///run/podman/podman.sock",
  },
  {
    id: "rancher-desktop",
    label: "Rancher Desktop",
    runtime: "rancher-desktop",
    socket: path.join(home, ".rd/docker.sock"),
    dockerHost: `unix://${path.join(home, ".rd/docker.sock")}`,
  },
]

const windowsSocketCandidates = (): Omit<
  DockerInstance,
  "present" | "running" | "version"
>[] => [
  {
    id: "docker-desktop-windows",
    label: "Docker Desktop",
    runtime: "docker-desktop",
    socket: "\\\\.\\pipe\\docker_engine",
    dockerHost: "npipe:////./pipe/docker_engine",
  },
]

const candidatesForPlatform = (): Omit<
  DockerInstance,
  "present" | "running" | "version"
>[] => {
  const home = os.homedir()
  switch (process.platform) {
    case "darwin":
      return macOsSocketCandidates(home)
    case "win32":
      return windowsSocketCandidates()
    default:
      return linuxSocketCandidates(home)
  }
}

const probeSocket = async (
  binary: string,
  dockerHost: string
): Promise<{ running: boolean; version?: string }> => {
  try {
    const { stdout } = await execFileAsync(
      binary,
      ["--host", dockerHost, "version", "--format", "{{.Server.Version}}"],
      { timeout: 4_000 }
    )
    const version = stdout.trim()
    if (version === "") return { running: false }
    return { running: true, version }
  } catch {
    return { running: false }
  }
}

/**
 * Enumerate every Docker daemon the user has installed. Each candidate
 * socket is checked for existence on disk, then probed via the CLI to
 * confirm the engine is responsive. The result is a deduplicated list
 * (by socket path) suitable for showing in a dropdown.
 *
 * Includes a `$DOCKER_HOST` entry when that env var is set, so users
 * with non-standard installs aren't excluded.
 */
export const listDockerInstances = async (
  onLog?: (level: "info" | "warn" | "error", msg: string) => void
): Promise<{ binary: string | null; instances: DockerInstance[] }> => {
  const log = onLog ?? (() => {})
  const binary = findDockerBinary()
  if (binary === null) {
    log("warn", "docker CLI not found on PATH or in any known install dir")
    return { binary: null, instances: [] }
  }
  log("info", `Using docker CLI at ${binary}`)

  const seen = new Set<string>()
  const candidates: Omit<DockerInstance, "present" | "running" | "version">[] =
    []

  // Env-var override first; it wins the auto-select tie-break if both
  // it and a standard socket are running.
  const dockerHostEnv = process.env["DOCKER_HOST"]
  if (dockerHostEnv !== undefined && dockerHostEnv !== "") {
    const socket = dockerHostEnv.replace(/^unix:\/\//, "")
    candidates.push({
      id: "env",
      label: `DOCKER_HOST env (${dockerHostEnv})`,
      runtime: "env",
      socket,
      dockerHost: dockerHostEnv,
    })
    seen.add(socket)
  }
  for (const c of candidatesForPlatform()) {
    if (seen.has(c.socket)) continue
    candidates.push(c)
    seen.add(c.socket)
  }

  const instances: DockerInstance[] = []
  for (const c of candidates) {
    const present = existsSync(c.socket)
    if (!present) {
      log("info", `${c.label}: socket ${c.socket} not present`)
      instances.push({ ...c, present: false, running: false })
      continue
    }
    log("info", `${c.label}: probing ${c.dockerHost}`)
    const { running, version } = await probeSocket(binary, c.dockerHost)
    if (running) {
      log("info", `${c.label}: engine reachable (${version})`)
    } else {
      log("warn", `${c.label}: socket present but engine not responding`)
    }
    instances.push({
      ...c,
      present: true,
      running,
      ...(version !== undefined ? { version } : {}),
    })
  }

  return { binary, instances }
}

export const runtimeLabel = (runtime: DockerRuntime): string => {
  switch (runtime) {
    case "docker-desktop":
      return "Docker Desktop"
    case "colima":
      return "Colima"
    case "orbstack":
      return "OrbStack"
    case "rancher-desktop":
      return "Rancher Desktop"
    case "podman":
      return "Podman"
    case "docker-engine":
      return "Docker Engine"
    case "env":
      return "$DOCKER_HOST"
    default:
      return "Docker"
  }
}
