import {
  type DockerInstance,
  listDockerInstances,
} from "./path"

export type DockerScanResult = {
  /** Path to the resolved CLI, or null if no `docker` binary is on PATH. */
  binary: string | null
  /** Every candidate socket, including ones that exist but don't respond. */
  instances: DockerInstance[]
  /** ID of the instance auto-selected as the default (running + first hit),
   *  or null if none are reachable. The user can override in the UI. */
  defaultId: string | null
}

/**
 * IntelliJ-style discovery: enumerate every Docker daemon socket we
 * know about, probe each, return the lot for the user to pick from.
 *
 * `onLog` receives one line per step so the bootstrap window can show
 * the search live rather than freezing on "Checking…".
 */
export const scanDocker = async (
  onLog?: (level: "info" | "warn" | "error", msg: string) => void
): Promise<DockerScanResult> => {
  const log = onLog ?? (() => {})
  log("info", "Looking for Docker daemons")
  const { binary, instances } = await listDockerInstances(log)

  if (binary === null) {
    log("warn", "No docker CLI found — Docker isn't installed")
    return { binary: null, instances: [], defaultId: null }
  }

  const running = instances.filter((i) => i.running)
  if (running.length === 0) {
    log("warn", "Found the CLI but no running daemon")
    return { binary, instances, defaultId: null }
  }

  // Auto-select the first running one. The UI lets the user override.
  const defaultId = running[0]?.id ?? null
  log("info", `Default selection: ${running[0]?.label ?? "(none)"}`)
  return { binary, instances, defaultId }
}

export const dockerInstallUrl = (): string => {
  switch (process.platform) {
    case "darwin":
      return "https://docs.docker.com/desktop/install/mac-install/"
    case "win32":
      return "https://docs.docker.com/desktop/install/windows-install/"
    default:
      return "https://docs.docker.com/engine/install/"
  }
}
