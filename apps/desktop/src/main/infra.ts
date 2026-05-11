import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// The two backing containers StellarStack Desktop needs alongside Docker:
//
//   - stellar-postgres : persistent state for the API
//   - stellar-redis    : status cache + session backing for better-auth
//
// Both run with `--restart unless-stopped`. On every launch the desktop
// app re-runs `ensureInfraRunning` to handle the case where the user
// manually stopped them — `docker start` on an already-running
// container is a no-op.
//
// `binary` and `dockerHost` are passed in from the bootstrap layer
// after the user picks which Docker daemon to use (IntelliJ-style
// dropdown). Every exec runs with `--host <socket>` so we never rely
// on the default socket which may not be the one the user wants.
// ---------------------------------------------------------------------------

const PG_NAME = "stellar-postgres"
const PG_IMAGE = "postgres:16-alpine"
const PG_HOST_PORT = 25_432
const PG_PASSWORD = "stellar-desktop-local"
const PG_DATABASE = "stellar"

const REDIS_NAME = "stellar-redis"
const REDIS_IMAGE = "redis:7-alpine"
const REDIS_HOST_PORT = 26_379

export const POSTGRES_URL = `postgres://stellar:${PG_PASSWORD}@localhost:${PG_HOST_PORT}/${PG_DATABASE}`
export const REDIS_URL = `redis://localhost:${REDIS_HOST_PORT}`

export type InfraTarget = {
  /** Absolute path to the docker CLI binary. */
  binary: string
  /** Docker host URL (e.g. `unix:///Users/.../docker.sock`) the CLI
   *  should talk to. */
  dockerHost: string
}

const dockerExec = async (
  target: InfraTarget,
  args: string[]
): Promise<string> => {
  const { stdout } = await execFileAsync(
    target.binary,
    ["--host", target.dockerHost, ...args],
    { timeout: 60_000 }
  )
  return stdout.trim()
}

type ContainerState = { exists: boolean; running: boolean }

const containerState = async (
  target: InfraTarget,
  name: string
): Promise<ContainerState> => {
  try {
    const out = await dockerExec(target, [
      "ps",
      "-a",
      "--filter",
      `name=^/${name}$`,
      "--format",
      "{{.State}}",
    ])
    if (out === "") return { exists: false, running: false }
    return { exists: true, running: out === "running" }
  } catch {
    return { exists: false, running: false }
  }
}

const ensureImage = async (
  target: InfraTarget,
  image: string,
  onStatus: (msg: string) => void
): Promise<void> => {
  try {
    const out = await dockerExec(target, [
      "image",
      "inspect",
      image,
      "--format",
      "{{.Id}}",
    ])
    if (out !== "") return
  } catch {
    // image isn't local
  }
  onStatus(`Pulling ${image}…`)
  await dockerExec(target, ["pull", image])
}

const ensurePostgres = async (
  target: InfraTarget,
  onStatus: (msg: string) => void
): Promise<void> => {
  const state = await containerState(target, PG_NAME)
  if (!state.exists) {
    await ensureImage(target, PG_IMAGE, onStatus)
    onStatus("Creating database container…")
    await dockerExec(target, [
      "run",
      "-d",
      "--name",
      PG_NAME,
      "-e",
      "POSTGRES_USER=stellar",
      "-e",
      `POSTGRES_PASSWORD=${PG_PASSWORD}`,
      "-e",
      `POSTGRES_DB=${PG_DATABASE}`,
      "-v",
      "stellar-pgdata:/var/lib/postgresql/data",
      "-p",
      `${String(PG_HOST_PORT)}:5432`,
      "--restart",
      "unless-stopped",
      PG_IMAGE,
    ])
  } else if (!state.running) {
    onStatus("Starting database…")
    await dockerExec(target, ["start", PG_NAME])
  }

  onStatus("Waiting for database…")
  for (let i = 0; i < 30; i++) {
    try {
      await dockerExec(target, [
        "exec",
        PG_NAME,
        "pg_isready",
        "-U",
        "stellar",
        "-d",
        PG_DATABASE,
      ])
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1_000))
    }
  }
  throw new Error("Postgres failed to accept connections after 30 seconds.")
}

const ensureRedis = async (
  target: InfraTarget,
  onStatus: (msg: string) => void
): Promise<void> => {
  const state = await containerState(target, REDIS_NAME)
  if (!state.exists) {
    await ensureImage(target, REDIS_IMAGE, onStatus)
    onStatus("Creating cache container…")
    await dockerExec(target, [
      "run",
      "-d",
      "--name",
      REDIS_NAME,
      "-v",
      "stellar-redisdata:/data",
      "-p",
      `${String(REDIS_HOST_PORT)}:6379`,
      "--restart",
      "unless-stopped",
      REDIS_IMAGE,
      "redis-server",
      "--appendonly",
      "yes",
    ])
  } else if (!state.running) {
    onStatus("Starting cache…")
    await dockerExec(target, ["start", REDIS_NAME])
  }

  onStatus("Waiting for cache…")
  for (let i = 0; i < 30; i++) {
    try {
      const out = await dockerExec(target, [
        "exec",
        REDIS_NAME,
        "redis-cli",
        "ping",
      ])
      if (out === "PONG") return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
  throw new Error("Redis failed to start after 30 seconds.")
}

export const ensureInfraRunning = async (
  target: InfraTarget,
  onStatus: (msg: string) => void
): Promise<{ postgresUrl: string; redisUrl: string }> => {
  await ensurePostgres(target, onStatus)
  await ensureRedis(target, onStatus)
  return { postgresUrl: POSTGRES_URL, redisUrl: REDIS_URL }
}
