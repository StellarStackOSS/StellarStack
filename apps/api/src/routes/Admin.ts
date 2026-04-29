import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"
import type { Queues } from "@/queues"
import { buildAdminBlueprintsRoute } from "@/routes/AdminBlueprints"
import { buildAdminNodesRoute } from "@/routes/AdminNodes"

const pingPayloadSchema = z.object({
  message: z.string().min(1).max(140).default("ping"),
})

/**
 * Build the `/admin` route group. Mounts admin-only sub-routes and shares
 * a single `requireSession + isAdmin` gate so every child inherits the
 * canonical `permissions.denied` envelope on a non-admin request.
 */
export const buildAdminRoute = (params: {
  auth: Auth
  db: Db
  env: Env
  queues: Queues
}) => {
  const { auth, db, env, queues } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .use("*", async (c, next) => {
      const user = c.get("user")
      if (user.isAdmin !== true) {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "admin" },
        })
      }
      await next()
    })
    .post("/ping", async (c) => {
      const parsed = pingPayloadSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const job = await queues.ping.add("ping", parsed.data, {
        removeOnComplete: 100,
        removeOnFail: 100,
      })
      return c.json({ jobId: job.id ?? null })
    })
    .route("/nodes", buildAdminNodesRoute({ db, env }))
    .route("/blueprints", buildAdminBlueprintsRoute({ db }))
}
