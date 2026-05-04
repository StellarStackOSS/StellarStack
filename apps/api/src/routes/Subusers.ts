import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import {
  serverSubusersTable,
  serversTable,
} from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const inviteSchema = z.object({
  email: z.string().email(),
  permissions: z.array(z.string()).min(1),
})

const updateSchema = z.object({
  permissions: z.array(z.string()).min(1),
})

export const buildSubusersRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/subusers", async (c) => {
      const serverId = c.req.param("serverId")
      await assertOwnerOrAdmin(db, c.get("user"), serverId)
      const rows = await db
        .select({
          id: serverSubusersTable.id,
          serverId: serverSubusersTable.serverId,
          userId: serverSubusersTable.userId,
          permissions: serverSubusersTable.permissions,
          createdAt: serverSubusersTable.createdAt,
          email: usersTable.email,
          name: usersTable.name,
        })
        .from(serverSubusersTable)
        .innerJoin(usersTable, eq(usersTable.id, serverSubusersTable.userId))
        .where(eq(serverSubusersTable.serverId, serverId))
      return c.json({ subusers: rows })
    })
    .post("/:serverId/subusers", async (c) => {
      const serverId = c.req.param("serverId")
      await assertOwnerOrAdmin(db, c.get("user"), serverId)
      const parsed = inviteSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const target = (
        await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, parsed.data.email))
          .limit(1)
      )[0]
      if (target === undefined) {
        throw new ApiException("auth.session.invalid", { status: 404 })
      }
      const [row] = await db
        .insert(serverSubusersTable)
        .values({
          serverId,
          userId: target.id,
          permissions: parsed.data.permissions,
        })
        .returning()
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      return c.json({
        subuser: {
          ...row,
          email: target.email,
          name: target.name,
        },
      })
    })
    .patch("/:serverId/subusers/:subuserId", async (c) => {
      const serverId = c.req.param("serverId")
      const subuserId = c.req.param("subuserId")
      await assertOwnerOrAdmin(db, c.get("user"), serverId)
      const parsed = updateSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const [row] = await db
        .update(serverSubusersTable)
        .set({ permissions: parsed.data.permissions })
        .where(
          and(
            eq(serverSubusersTable.id, subuserId),
            eq(serverSubusersTable.serverId, serverId)
          )
        )
        .returning()
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 404 })
      }
      const target = (
        await db
          .select({ email: usersTable.email, name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, row.userId))
          .limit(1)
      )[0]
      return c.json({
        subuser: {
          ...row,
          email: target?.email ?? "",
          name: target?.name ?? null,
        },
      })
    })
    .delete("/:serverId/subusers/:subuserId", async (c) => {
      const serverId = c.req.param("serverId")
      const subuserId = c.req.param("subuserId")
      await assertOwnerOrAdmin(db, c.get("user"), serverId)
      await db
        .delete(serverSubusersTable)
        .where(
          and(
            eq(serverSubusersTable.id, subuserId),
            eq(serverSubusersTable.serverId, serverId)
          )
        )
      return c.json({ ok: true })
    })
}

const assertOwnerOrAdmin = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<void> => {
  const server = (
    await db
      .select({ ownerId: serversTable.ownerId })
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (server === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  if (user.isAdmin === true) return
  if (server.ownerId === user.id) return
  throw new ApiException("permissions.denied", { status: 403 })
}
