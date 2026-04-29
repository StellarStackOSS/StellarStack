import { Hono } from "hono"

/**
 * Liveness probe. Returns the constant `{ status: "ok" }` when the API
 * process is up — does not check downstream dependencies. The deeper
 * `/ready` probe (added later) verifies database + Redis connectivity.
 */
export const healthRoute = new Hono().get("/", (c) => c.json({ status: "ok" } as const))
