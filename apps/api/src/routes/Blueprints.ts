import { eq } from "drizzle-orm"
import { Hono } from "hono"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { blueprintSchema } from "@workspace/shared/blueprint"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { AuthVariables } from "@/middleware/RequireSession"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"
import { buildRequireSession } from "@/middleware/RequireSession"

export const buildBlueprintsRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const requireSession = buildRequireSession(auth)
  const adminMiddleware = buildRequireAdmin(auth)

  const router = new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/", async (c) => {
      const rows = await db.select().from(blueprintsTable)
      return c.json({ blueprints: rows })
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const row = (
        await db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, id))
          .limit(1)
      )[0]
      if (row === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      return c.json({ blueprint: row })
    })

  // Admin write paths.
  router.use("*", ...adminMiddleware)

  return router
    .post("/", async (c) => {
      const parsed = blueprintSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const data = parsed.data
      const [row] = await db
        .insert(blueprintsTable)
        .values({
          schemaVersion: String(data.schemaVersion),
          name: data.name,
          description: data.description ?? null,
          author: data.author ?? null,
          dockerImages: data.dockerImages,
          stopSignal: data.stopSignal,
          startupCommand: data.startupCommand,
          configFiles: data.configFiles ?? null,
          variables: data.variables,
          installImage: data.install.image,
          installEntrypoint: data.install.entrypoint,
          installScript: data.install.script,
          lifecycle: data.lifecycle,
          features: data.features ?? null,
        })
        .returning()
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      return c.json({ blueprint: row })
    })
    .put("/:id", async (c) => {
      const id = c.req.param("id")
      const parsed = blueprintSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const data = parsed.data
      const [row] = await db
        .update(blueprintsTable)
        .set({
          schemaVersion: String(data.schemaVersion),
          name: data.name,
          description: data.description ?? null,
          author: data.author ?? null,
          dockerImages: data.dockerImages,
          stopSignal: data.stopSignal,
          startupCommand: data.startupCommand,
          configFiles: data.configFiles ?? null,
          variables: data.variables,
          installImage: data.install.image,
          installEntrypoint: data.install.entrypoint,
          installScript: data.install.script,
          lifecycle: data.lifecycle,
          features: data.features ?? null,
          updatedAt: new Date(),
        })
        .where(eq(blueprintsTable.id, id))
        .returning()
      if (row === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      return c.json({ blueprint: row })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      await db.delete(blueprintsTable).where(eq(blueprintsTable.id, id))
      return c.json({ ok: true })
    })
}
