import { and, asc, eq, inArray } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  scheduleTasksTable,
  schedulesTable,
} from "@workspace/db/schema/schedules"
import { serversTable } from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const taskSchema = z.object({
  sortOrder: z.number().int().nonnegative(),
  action: z.enum(["power", "command", "backup"]),
  delaySeconds: z.number().int().nonnegative(),
  payload: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .nullable(),
})
const scheduleInputSchema = z.object({
  name: z.string().min(1).max(120),
  cron: z.string().min(1).max(120),
  enabled: z.boolean(),
  onlyWhenOnline: z.boolean(),
  tasks: z.array(taskSchema),
})

export const buildSchedulesRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:serverId/schedules", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const schedules = await db
        .select()
        .from(schedulesTable)
        .where(eq(schedulesTable.serverId, serverId))
      const ids = schedules.map((s) => s.id)
      const tasks =
        ids.length === 0
          ? []
          : await db
              .select()
              .from(scheduleTasksTable)
              .where(inArray(scheduleTasksTable.scheduleId, ids))
              .orderBy(
                asc(scheduleTasksTable.scheduleId),
                asc(scheduleTasksTable.sortOrder)
              )
      const grouped = new Map<string, typeof tasks>()
      for (const t of tasks) {
        const list = grouped.get(t.scheduleId) ?? []
        list.push(t)
        grouped.set(t.scheduleId, list)
      }
      return c.json({
        schedules: schedules.map((s) => ({
          ...s,
          tasks: grouped.get(s.id) ?? [],
        })),
      })
    })
    .post("/:serverId/schedules", async (c) => {
      const serverId = c.req.param("serverId")
      await assertAccess(db, c.get("user"), serverId)
      const parsed = scheduleInputSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const out = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schedulesTable)
          .values({
            serverId,
            name: parsed.data.name,
            cron: parsed.data.cron,
            enabled: parsed.data.enabled,
            onlyWhenOnline: parsed.data.onlyWhenOnline,
          })
          .returning()
        if (row === undefined) throw new Error("insert failed")
        const taskRows = parsed.data.tasks.map((t) => ({
          scheduleId: row.id,
          sortOrder: t.sortOrder,
          action: t.action,
          delaySeconds: t.delaySeconds,
          payload: t.payload,
        }))
        if (taskRows.length > 0) {
          await tx.insert(scheduleTasksTable).values(taskRows)
        }
        return { ...row, tasks: taskRows }
      })
      return c.json({ schedule: out })
    })
    .patch("/:serverId/schedules/:scheduleId", async (c) => {
      const serverId = c.req.param("serverId")
      const scheduleId = c.req.param("scheduleId")
      await assertAccess(db, c.get("user"), serverId)
      const parsed = scheduleInputSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const out = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(schedulesTable)
          .set({
            name: parsed.data.name,
            cron: parsed.data.cron,
            enabled: parsed.data.enabled,
            onlyWhenOnline: parsed.data.onlyWhenOnline,
          })
          .where(
            and(
              eq(schedulesTable.id, scheduleId),
              eq(schedulesTable.serverId, serverId)
            )
          )
          .returning()
        if (row === undefined) {
          throw new ApiException("internal.unexpected", { status: 404 })
        }
        await tx
          .delete(scheduleTasksTable)
          .where(eq(scheduleTasksTable.scheduleId, scheduleId))
        const taskRows = parsed.data.tasks.map((t) => ({
          scheduleId,
          sortOrder: t.sortOrder,
          action: t.action,
          delaySeconds: t.delaySeconds,
          payload: t.payload,
        }))
        if (taskRows.length > 0) {
          await tx.insert(scheduleTasksTable).values(taskRows)
        }
        return { ...row, tasks: taskRows }
      })
      return c.json({ schedule: out })
    })
    .delete("/:serverId/schedules/:scheduleId", async (c) => {
      const serverId = c.req.param("serverId")
      const scheduleId = c.req.param("scheduleId")
      await assertAccess(db, c.get("user"), serverId)
      await db
        .delete(schedulesTable)
        .where(
          and(
            eq(schedulesTable.id, scheduleId),
            eq(schedulesTable.serverId, serverId)
          )
        )
      return c.json({ ok: true })
    })
}

const assertAccess = async (
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
