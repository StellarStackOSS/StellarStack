import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

const CONTAINER_NAME = "stellar-postgres"
const IMAGE = "postgres:16-alpine"
const HOST_PORT = 25_432 // off the default to avoid clashing with a user's own pg
const PASSWORD = "stellar-desktop-local"
const DATABASE = "stellar"

export const POSTGRES_URL = `postgres://stellar:${PASSWORD}@localhost:${HOST_PORT}/${DATABASE}`

const dockerExec = async (cmd: string): Promise<string> => {
  const { stdout } = await execAsync(cmd, { timeout: 30_000 })
  return stdout.trim()
}

const containerExists = async (): Promise<{
  exists: boolean
  running: boolean
}> => {
  try {
    const out = await dockerExec(
      `docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format "{{.State}}"`
    )
    if (out === "") return { exists: false, running: false }
    return { exists: true, running: out === "running" }
  } catch {
    return { exists: false, running: false }
  }
}

/**
 * Make sure the embedded Postgres container exists, is started, and is
 * accepting connections. Idempotent — safe to call on every desktop app
 * launch. Data persists in a named Docker volume across launches.
 */
export const ensurePostgresRunning = async (
  onStatus: (msg: string) => void
): Promise<{ url: string }> => {
  const state = await containerExists()
  if (!state.exists) {
    onStatus("Pulling Postgres image…")
    await dockerExec(`docker pull ${IMAGE}`)
    onStatus("Creating database container…")
    await dockerExec(
      `docker run -d --name ${CONTAINER_NAME} ` +
        `-e POSTGRES_USER=stellar ` +
        `-e POSTGRES_PASSWORD=${PASSWORD} ` +
        `-e POSTGRES_DB=${DATABASE} ` +
        `-v stellar-pgdata:/var/lib/postgresql/data ` +
        `-p ${String(HOST_PORT)}:5432 ` +
        `--restart unless-stopped ` +
        `${IMAGE}`
    )
  } else if (!state.running) {
    onStatus("Starting database…")
    await dockerExec(`docker start ${CONTAINER_NAME}`)
  } else {
    onStatus("Database already running.")
  }

  // Wait for Postgres to accept connections — pulled image first-boot can
  // take a few seconds to finish initdb.
  onStatus("Waiting for database to accept connections…")
  for (let i = 0; i < 30; i++) {
    try {
      await dockerExec(
        `docker exec ${CONTAINER_NAME} pg_isready -U stellar -d ${DATABASE}`
      )
      return { url: POSTGRES_URL }
    } catch {
      await new Promise((r) => setTimeout(r, 1_000))
    }
  }
  throw new Error("Postgres failed to accept connections after 30 seconds.")
}
