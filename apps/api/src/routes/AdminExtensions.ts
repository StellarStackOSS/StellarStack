import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { ApiException } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"
import type { AuthVariables } from "@/middleware/RequireSession"
import { SettingsStore } from "@/lib/Settings"

/**
 * Admin → Extensions page. Backing storage for third-party API keys
 * (Modrinth doesn't need one, CurseForge does). Reads never return
 * the raw value — only `configured: true/false` + a redacted preview.
 * Writes accept the new value, encrypt, persist.
 */

const KEYS = {
  curseforge: "extensions.curseforge.api_key",
  // Reserved keys for the next round of extensions. Listing them up
  // front so the UI can render their slots even when empty.
  // modrinth doesn't need a key but we record `enabled` so admins can
  // turn the integration off.
  modrinthEnabled: "extensions.modrinth.enabled",
} as const

const putBodySchema = z.object({
  curseforgeApiKey: z.string().nullable().optional(),
  modrinthEnabled: z.boolean().optional(),
})

export const buildAdminExtensionsRoute = (params: {
  auth: Auth
  db: Db
  betterAuthSecret: string
}) => {
  const requireAdmin = buildRequireAdmin(params.auth)
  const store = new SettingsStore(params.db, params.betterAuthSecret)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", ...requireAdmin)
    .get("/", async (c) => {
      const [cfKey, modrinthRaw] = await Promise.all([
        store.get(KEYS.curseforge),
        store.get(KEYS.modrinthEnabled),
      ])
      return c.json({
        curseforge: {
          configured: cfKey !== null && cfKey !== "",
          preview: cfKey === null || cfKey === "" ? null : redact(cfKey),
        },
        modrinth: {
          // Default-on; settings row only stores explicit overrides.
          enabled: modrinthRaw === null ? true : modrinthRaw === "1",
        },
      })
    })
    .put("/", async (c) => {
      const parsed = putBodySchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw new ApiException("validation.invalid_body", { status: 400 })
      }
      const user = c.get("user")
      const { curseforgeApiKey, modrinthEnabled } = parsed.data

      if (curseforgeApiKey !== undefined) {
        if (curseforgeApiKey === null || curseforgeApiKey === "") {
          await store.delete(KEYS.curseforge)
        } else {
          await store.set(KEYS.curseforge, curseforgeApiKey, {
            encrypted: true,
            userId: user.id,
          })
        }
      }
      if (modrinthEnabled !== undefined) {
        await store.set(KEYS.modrinthEnabled, modrinthEnabled ? "1" : "0", {
          userId: user.id,
        })
      }
      return c.json({ ok: true })
    })
}

const redact = (value: string): string => {
  if (value.length <= 8) return "********"
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
