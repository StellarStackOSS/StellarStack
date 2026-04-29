import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import { clientIp, writeAudit } from "@/audit"
import type { AuthVariables } from "@/middleware/RequireSession"

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
})

/**
 * Admin-only user management. Supports listing all users and patching
 * `isAdmin` / `emailVerified` flags on a specific user.
 */
export const buildAdminUsersRoute = (params: { db: Db }) => {
  const { db } = params

  return new Hono<{ Variables: AuthVariables }>()
    .get("/", async (c) => {
      const rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          isAdmin: usersTable.isAdmin,
          emailVerified: usersTable.emailVerified,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .orderBy(usersTable.createdAt)
      return c.json({ users: rows })
    })
    .patch("/:id", async (c) => {
      const userId = c.req.param("id")
      const actor = c.get("user")

      const parsed = updateUserSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }

      const existing = (
        await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1)
      )[0]
      if (existing === undefined) {
        throw new ApiException("auth.session.invalid", { status: 404 })
      }

      const updates: Partial<typeof usersTable.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (parsed.data.isAdmin !== undefined) {
        updates.isAdmin = parsed.data.isAdmin
      }
      if (parsed.data.emailVerified !== undefined) {
        updates.emailVerified = parsed.data.emailVerified
      }

      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, userId))
        .returning()

      const meta: Record<string, string | number | boolean> = {}
      if (parsed.data.isAdmin !== undefined) {
        meta.isAdmin = parsed.data.isAdmin
      }
      if (parsed.data.emailVerified !== undefined) {
        meta.emailVerified = parsed.data.emailVerified
      }

      writeAudit({
        db,
        actorId: actor.id,
        ip: clientIp(c),
        action: "user.update",
        targetType: "user",
        targetId: userId,
        metadata: meta,
      })

      return c.json({ user: updated })
    })
}
