import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"
import type { AuthVariables } from "@/middleware/RequireSession"

const patchSchema = z.object({
  isAdmin: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  preferredLocale: z.string().min(2).max(10).optional(),
})

export const buildAdminUsersRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const adminMiddleware = buildRequireAdmin(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", ...adminMiddleware)
    .get("/", async (c) => {
      const rows = await db.select().from(usersTable)
      return c.json({ users: rows })
    })
    .patch("/:id", async (c) => {
      const id = c.req.param("id")
      const parsed = patchSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const [row] = await db
        .update(usersTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(usersTable.id, id))
        .returning()
      if (row === undefined) {
        throw new ApiException("auth.session.invalid", { status: 404 })
      }
      return c.json({ user: row })
    })
}
