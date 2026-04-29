import { Hono } from "hono"
import { eq } from "drizzle-orm"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { blueprintSchema } from "@workspace/shared/blueprint"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { AuthVariables } from "@/middleware/RequireSession"

/**
 * Admin-only blueprint CRUD. Mounted under `/admin/blueprints` so the
 * parent /admin requireAdmin gate applies. Inputs are parsed through
 * `blueprintSchema` so the on-the-wire shape and the persisted shape are
 * never out of sync; field-level errors flow back as `validation.failed`
 * envelopes with per-field translation keys.
 */
export const buildAdminBlueprintsRoute = (params: { db: Db }) => {
  const { db } = params

  return new Hono<{ Variables: AuthVariables }>()
    .get("/", async (c) => {
      const rows = await db.select().from(blueprintsTable)
      return c.json({ blueprints: rows })
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const rows = await db
        .select()
        .from(blueprintsTable)
        .where(eq(blueprintsTable.id, id))
        .limit(1)
      const row = rows[0]
      if (row === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      return c.json({ blueprint: row })
    })
    .post("/", async (c) => {
      const parsed = blueprintSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const author = parsed.data.author ?? null
      const inserted = await db
        .insert(blueprintsTable)
        .values({
          schemaVersion: String(parsed.data.schemaVersion),
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          author,
          dockerImages: parsed.data.dockerImages,
          stopSignal: parsed.data.stopSignal,
          startupCommand: parsed.data.startupCommand,
          configFiles: parsed.data.configFiles ?? null,
          variables: parsed.data.variables,
          installImage: parsed.data.install.image,
          installEntrypoint: parsed.data.install.entrypoint,
          installScript: parsed.data.install.script,
          lifecycle: parsed.data.lifecycle,
          features: parsed.data.features ?? null,
        })
        .returning()
      const row = inserted[0]
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      return c.json({ blueprint: row }, 201)
    })
    .put("/:id", async (c) => {
      const id = c.req.param("id")
      const parsed = blueprintSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const updated = await db
        .update(blueprintsTable)
        .set({
          schemaVersion: String(parsed.data.schemaVersion),
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          author: parsed.data.author ?? null,
          dockerImages: parsed.data.dockerImages,
          stopSignal: parsed.data.stopSignal,
          startupCommand: parsed.data.startupCommand,
          configFiles: parsed.data.configFiles ?? null,
          variables: parsed.data.variables,
          installImage: parsed.data.install.image,
          installEntrypoint: parsed.data.install.entrypoint,
          installScript: parsed.data.install.script,
          lifecycle: parsed.data.lifecycle,
          features: parsed.data.features ?? null,
          updatedAt: new Date(),
        })
        .where(eq(blueprintsTable.id, id))
        .returning()
      const row = updated[0]
      if (row === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      return c.json({ blueprint: row })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      const deleted = await db
        .delete(blueprintsTable)
        .where(eq(blueprintsTable.id, id))
        .returning({ id: blueprintsTable.id })
      const row = deleted[0]
      if (row === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      return c.json({ ok: true })
    })
}
