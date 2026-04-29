import { Hono } from "hono"
import { z } from "zod"

import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"
import type { Queues } from "@/queues"

const pingPayloadSchema = z.object({
  message: z.string().min(1).max(140).default("ping"),
})

/**
 * Build the `/admin` route group. Currently exposes a single smoke-test
 * action used to drive the api → BullMQ → worker → Redis pub/sub →
 * panel-event WS pipeline end to end before any product surface exists.
 *
 * Every handler enforces `user.isAdmin === true`; non-admin requests bounce
 * with the standard `permissions.denied` envelope.
 */
export const buildAdminRoute = (params: { auth: Auth; queues: Queues }) => {
  const { auth, queues } = params
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
}
