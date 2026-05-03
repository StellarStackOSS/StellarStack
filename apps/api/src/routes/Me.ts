import { Hono } from "hono"

import type { Auth } from "@/auth"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

export const buildMeRoute = (auth: Auth) => {
  const requireSession = buildRequireSession(auth)
  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/", (c) => {
      const user = c.get("user")
      return c.json({ user })
    })
}
