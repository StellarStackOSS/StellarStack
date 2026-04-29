import { Hono } from "hono"
import { CronExpressionParser } from "cron-parser"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  scheduleTasksTable,
  schedulesTable,
} from "@workspace/db/schema/schedules"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import { loadServerAccess, requireScope } from "@/access"
import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const taskSchema = z.object({
  sortOrder: z.number().int().min(0).max(1024),
  action: z.enum(["power", "command", "backup"]),
  delaySeconds: z.number().int().min(0).max(24 * 60 * 60),
  payload: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()])
    )
    .nullable()
    .optional(),
})

const createScheduleSchema = z.object({
  name: z.string().min(1).max(64),
  cron: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  onlyWhenOnline: z.boolean().default(false),
  tasks: z.array(taskSchema).max(32).default([]),
})

const updateScheduleSchema = createScheduleSchema.partial()

const parseCron = (cron: string): Date => {
  try {
    const it = CronExpressionParser.parse(cron, { tz: "UTC" })
    return it.next().toDate()
  } catch {
    throw new ApiException("schedules.cron_invalid", {
      status: 400,
      params: { cron },
    })
  }
}

/**
 * Per-server schedule + ordered task CRUD. Routes are mounted under
 * `/servers/:id/schedules` so they share the standard subuser-aware
 * access check. The worker's cron tick is the consumer; this route only
 * persists rows + recomputes `nextRunAt` whenever the cron expression or
 * `enabled` flag changes.
 */
export const buildSchedulesRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/schedules", async (c) => {
      const id = c.req.param("id")
      const access = await loadServerAccess(db, c.get("user"), id)
      requireScope(access, "console.read")
      const schedules = await db
        .select()
        .from(schedulesTable)
        .where(eq(schedulesTable.serverId, id))
        .orderBy(asc(schedulesTable.createdAt))
      const ids = schedules.map((s) => s.id)
      const allTasks =
        ids.length === 0
          ? []
          : await db
              .select()
              .from(scheduleTasksTable)
              .orderBy(asc(scheduleTasksTable.sortOrder))
      const grouped = schedules.map((s) => ({
        ...s,
        tasks: allTasks.filter((t) => t.scheduleId === s.id),
      }))
      return c.json({ schedules: grouped })
    })
    .post("/:id/schedules", async (c) => {
      const id = c.req.param("id")
      const access = await loadServerAccess(db, c.get("user"), id)
      requireScope(access, "console.write")
      const parsed = createScheduleSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const nextRunAt = parsed.data.enabled ? parseCron(parsed.data.cron) : null
      const inserted = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(schedulesTable)
          .values({
            serverId: id,
            name: parsed.data.name,
            cron: parsed.data.cron,
            enabled: parsed.data.enabled,
            onlyWhenOnline: parsed.data.onlyWhenOnline,
            nextRunAt,
          })
          .returning()
        const schedule = rows[0]
        if (schedule === undefined) {
          throw new ApiException("internal.unexpected", { status: 500 })
        }
        if (parsed.data.tasks.length > 0) {
          await tx.insert(scheduleTasksTable).values(
            parsed.data.tasks.map((t) => ({
              scheduleId: schedule.id,
              sortOrder: t.sortOrder,
              action: t.action,
              delaySeconds: t.delaySeconds,
              payload: t.payload ?? null,
            }))
          )
        }
        return schedule
      })
      return c.json({ schedule: inserted }, 201)
    })
    .patch("/:id/schedules/:sid", async (c) => {
      const id = c.req.param("id")
      const sid = c.req.param("sid")
      const access = await loadServerAccess(db, c.get("user"), id)
      requireScope(access, "console.write")
      const parsed = updateScheduleSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const existing = (
        await db
          .select()
          .from(schedulesTable)
          .where(
            and(
              eq(schedulesTable.id, sid),
              eq(schedulesTable.serverId, id)
            )
          )
          .limit(1)
      )[0]
      if (existing === undefined) {
        throw new ApiException("schedules.not_found", { status: 404 })
      }
      const cron = parsed.data.cron ?? existing.cron
      const enabled = parsed.data.enabled ?? existing.enabled
      const updates: Partial<typeof schedulesTable.$inferInsert> = {}
      if (parsed.data.name !== undefined) updates.name = parsed.data.name
      if (parsed.data.cron !== undefined) updates.cron = parsed.data.cron
      if (parsed.data.enabled !== undefined)
        updates.enabled = parsed.data.enabled
      if (parsed.data.onlyWhenOnline !== undefined)
        updates.onlyWhenOnline = parsed.data.onlyWhenOnline
      if (
        parsed.data.cron !== undefined ||
        parsed.data.enabled !== undefined
      ) {
        updates.nextRunAt = enabled ? parseCron(cron) : null
      }
      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .update(schedulesTable)
          .set(updates)
          .where(eq(schedulesTable.id, sid))
          .returning()
        if (parsed.data.tasks !== undefined) {
          await tx
            .delete(scheduleTasksTable)
            .where(eq(scheduleTasksTable.scheduleId, sid))
          if (parsed.data.tasks.length > 0) {
            await tx.insert(scheduleTasksTable).values(
              parsed.data.tasks.map((t) => ({
                scheduleId: sid,
                sortOrder: t.sortOrder,
                action: t.action,
                delaySeconds: t.delaySeconds,
                payload: t.payload ?? null,
              }))
            )
          }
        }
        return rows[0]
      })
      return c.json({ schedule: updated })
    })
    .delete("/:id/schedules/:sid", async (c) => {
      const id = c.req.param("id")
      const sid = c.req.param("sid")
      const access = await loadServerAccess(db, c.get("user"), id)
      requireScope(access, "console.write")
      const deleted = await db
        .delete(schedulesTable)
        .where(
          and(eq(schedulesTable.id, sid), eq(schedulesTable.serverId, id))
        )
        .returning({ id: schedulesTable.id })
      if (deleted[0] === undefined) {
        throw new ApiException("schedules.not_found", { status: 404 })
      }
      return c.json({ ok: true })
    })
}
