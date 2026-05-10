import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export type DockerStatus =
  | { kind: "ok"; version: string }
  | { kind: "missing" }
  | { kind: "not-running" }

/**
 * First-run gate. We need Docker on the user's machine because the
 * StellarStack daemon shells out to it for every container action. If it's
 * not installed, the bootstrap window points the user at the download
 * page; if it's installed but stopped, the user is asked to start it.
 *
 * This is a best-effort check — `docker version --format` is the cheapest
 * way to ask "is the daemon socket alive". We don't try to fix anything
 * automatically.
 */
export const checkDocker = async (): Promise<DockerStatus> => {
  try {
    const { stdout } = await execAsync(
      "docker version --format '{{.Server.Version}}'",
      { timeout: 5_000 }
    )
    const version = stdout.trim()
    if (version === "") return { kind: "not-running" }
    return { kind: "ok", version }
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? "")
    // The CLI is installed but the daemon isn't reachable — usually
    // "Cannot connect to the Docker daemon" or "the docker daemon is
    // not running" on Windows.
    if (
      stderr.includes("Cannot connect to") ||
      stderr.includes("daemon is not running")
    ) {
      return { kind: "not-running" }
    }
    return { kind: "missing" }
  }
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
