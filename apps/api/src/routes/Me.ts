import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import { apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  preferredLocale: z.string().min(2).max(10).optional(),
  image: z.string().url().nullable().optional(),
})

export const buildMeRoute = (auth: Auth, db: Db) => {
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/", (c) => {
      const user = c.get("user")
      return c.json({ user })
    })
    .patch("/", async (c) => {
      const user = c.get("user")
      const parsed = updateProfileSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db
        .update(usersTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id))
      const updated = (
        await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, user.id))
          .limit(1)
      )[0]
      return c.json({ user: updated })
    })
}
