import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

const updateProfileSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  preferredLocale: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[a-zA-Z-]+$/)
    .optional(),
  image: z.string().url().max(2048).nullable().optional(),
})

/**
 * Build the `/me` route group. `GET /me` returns the current session's
 * user; `PATCH /me` updates the profile, demonstrating the Zod →
 * `apiValidationError` → translation-key envelope path that all other
 * mutation routes will follow.
 */
export const buildMeRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/", (c) => {
      const user = c.get("user")
      return c.json({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      })
    })
    .patch("/", async (c) => {
      const parsed = updateProfileSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const user = c.get("user")
      const updated = await db
        .update(usersTable)
        .set({
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.preferredLocale !== undefined ? { preferredLocale: parsed.data.preferredLocale } : {}),
          ...(parsed.data.image !== undefined ? { image: parsed.data.image } : {}),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id))
        .returning()

      const row = updated[0]
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }

      return c.json({
        id: row.id,
        email: row.email,
        name: row.name,
        preferredLocale: row.preferredLocale,
      })
    })
}
