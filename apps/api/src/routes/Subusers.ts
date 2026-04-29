import { Hono } from "hono"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { usersTable } from "@workspace/db/schema/auth"
import { serverSubusersTable, serversTable } from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"
import { daemonJwtScopes } from "@workspace/shared/jwt"

import { clientIp, writeAudit } from "@/audit"
import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const subuserScopeSchema = z.enum(daemonJwtScopes)

const inviteSubuserSchema = z.object({
  email: z.string().email().max(255),
  permissions: z.array(subuserScopeSchema).min(1).max(32),
})

const updateSubuserSchema = z.object({
  permissions: z.array(subuserScopeSchema).min(1).max(32),
})

const requireServerOwner = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
) => {
  const row = (
    await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (row === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  if (user.isAdmin !== true && row.ownerId !== user.id) {
    throw new ApiException("permissions.denied", {
      status: 403,
      params: { statement: "subusers.manage" },
    })
  }
  return row
}

/**
 * Per-server subuser CRUD. The owner (and any admin) can invite users by
 * email, grant a fine-grained permission set, and revoke. Subusers can't
 * manage subusers — that includes themselves, so a subuser navigating to
 * the Users tab gets `permissions.denied`.
 */
export const buildSubusersRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/subusers", async (c) => {
      const id = c.req.param("id")
      await requireServerOwner(db, c.get("user"), id)
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
        .innerJoin(usersTable, eq(serverSubusersTable.userId, usersTable.id))
        .where(eq(serverSubusersTable.serverId, id))
      return c.json({ subusers: rows })
    })
    .post("/:id/subusers", async (c) => {
      const id = c.req.param("id")
      const server = await requireServerOwner(db, c.get("user"), id)
      const parsed = inviteSubuserSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const target = (
        await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, parsed.data.email))
          .limit(1)
      )[0]
      if (target === undefined) {
        throw new ApiException("auth.signup.email_taken", {
          status: 404,
          params: { email: parsed.data.email },
        })
      }
      if (target.id === server.ownerId) {
        throw new ApiException("permissions.denied", {
          status: 409,
          params: { statement: "subusers.owner" },
        })
      }
      const inserted = await db
        .insert(serverSubusersTable)
        .values({
          serverId: id,
          userId: target.id,
          permissions: parsed.data.permissions,
        })
        .onConflictDoNothing()
        .returning()
      const row = inserted[0]
      if (row === undefined) {
        throw new ApiException("permissions.denied", {
          status: 409,
          params: { statement: "subusers.duplicate" },
        })
      }
      writeAudit({
        db,
        actorId: c.get("user").id,
        ip: clientIp(c),
        action: "subuser.invite",
        targetType: "server",
        targetId: id,
        metadata: { userId: target.id },
      })
      return c.json({ subuser: row }, 201)
    })
    .patch("/:id/subusers/:subId", async (c) => {
      const id = c.req.param("id")
      const subId = c.req.param("subId")
      await requireServerOwner(db, c.get("user"), id)
      const parsed = updateSubuserSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const updated = await db
        .update(serverSubusersTable)
        .set({ permissions: parsed.data.permissions })
        .where(
          and(
            eq(serverSubusersTable.id, subId),
            eq(serverSubusersTable.serverId, id)
          )
        )
        .returning()
      if (updated[0] === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      return c.json({ subuser: updated[0] })
    })
    .delete("/:id/subusers/:subId", async (c) => {
      const id = c.req.param("id")
      const subId = c.req.param("subId")
      await requireServerOwner(db, c.get("user"), id)
      const deleted = await db
        .delete(serverSubusersTable)
        .where(
          and(
            eq(serverSubusersTable.id, subId),
            eq(serverSubusersTable.serverId, id)
          )
        )
        .returning({ id: serverSubusersTable.id })
      if (deleted[0] === undefined) {
        throw new ApiException("servers.not_found", { status: 404 })
      }
      writeAudit({
        db,
        actorId: c.get("user").id,
        ip: clientIp(c),
        action: "subuser.remove",
        targetType: "server",
        targetId: id,
        metadata: { subuserId: subId },
      })
      return c.json({ ok: true })
    })
}
