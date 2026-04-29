import { Hono } from "hono"

import type { Auth } from "@/auth"

/**
 * Mounts better-auth's request handler. Better-auth ships a single
 * `auth.handler(request)` entry that owns all `/api/auth/*` routes
 * (sign-in/up, verify, reset, sessions). Mount under `/auth/*`.
 */
export const buildAuthRoute = (auth: Auth) =>
  new Hono().all("/*", (c) => auth.handler(c.req.raw))
