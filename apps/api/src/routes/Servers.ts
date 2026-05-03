import { eq, or } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import {
  serverSubusersTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"
import type { DaemonJwtScope } from "@workspace/shared/jwt.types"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import type { StatusCache } from "@/lib/StatusCache"
import { mintDaemonToken } from "@/lib/Tokens"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

const credentialsBodySchema = z.object({
  purpose: z.enum(["console", "files", "sftp"]).default("console"),
})

const purposeScopes: Record<
  z.infer<typeof credentialsBodySchema>["purpose"],
  { scopes: DaemonJwtScope[]; ttlSeconds: number }
> = {
  console: {
    scopes: [
      "console.read",
      "console.write",
      "stats.read",
      "control.start",
      "control.stop",
      "control.restart",
    ],
    ttlSeconds: 600,
  },
  files: {
    scopes: ["files.read", "files.write", "files.delete"],
    ttlSeconds: 600,
  },
  sftp: {
    scopes: ["sftp"],
    ttlSeconds: 86_400,
  },
}

/**
 * Server CRUD + the credentials endpoint that mints the per-node JWT
 * the browser uses to dial the daemon directly.
 */
export const buildServersRoute = (params: {
  auth: Auth
  db: Db
  env: Env
  statusCache: StatusCache
}) => {
  const { auth, db, env, statusCache } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/", async (c) => {
      const user = c.get("user")
      const ownedRows = user.isAdmin === true
        ? await db.select().from(serversTable)
        : await db
            .select({ s: serversTable })
            .from(serversTable)
            .leftJoin(
              serverSubusersTable,
              eq(serverSubusersTable.serverId, serversTable.id)
            )
            .where(
              or(
                eq(serversTable.ownerId, user.id),
                eq(serverSubusersTable.userId, user.id)
              )
            )
            .then((rows) => {
              const seen = new Set<string>()
              const out = []
              for (const r of rows) {
                const row = "s" in r ? r.s : r
                if (seen.has(row.id)) continue
                seen.add(row.id)
                out.push(row)
              }
              return out
            })
      // Overlay live status from Redis cache (daemon's HTTP callback
      // populates it). Rows without a cache entry use the DB value.
      const cached = await statusCache.getMany(ownedRows.map((r) => r.id))
      const merged = ownedRows.map((r) => ({
        ...r,
        status: cached.get(r.id) ?? r.status,
      }))
      return c.json({ servers: merged })
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      const node = (
        await db
          .select({ name: nodesTable.name })
          .from(nodesTable)
          .where(eq(nodesTable.id, access.server.nodeId))
          .limit(1)
      )[0]
      const cached = await statusCache.get(id)
      return c.json({
        server: {
          ...access.server,
          status: cached ?? access.server.status,
          nodeName: node?.name ?? null,
        },
        access: { role: access.role, permissions: access.permissions },
      })
    })
    .post("/:id/credentials", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      const parsed = credentialsBodySchema.safeParse(
        await c.req.json().catch(() => ({}))
      )
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const config = purposeScopes[parsed.data.purpose]
      const allowedSet = new Set<DaemonJwtScope>(
        access.permissions as DaemonJwtScope[]
      )
      // Owner / admin gets every scope the purpose declares.
      const granted: DaemonJwtScope[] = config.scopes.filter(
        (s) => access.role === "owner" || access.role === "admin" || allowedSet.has(s)
      )
      if (granted.length === 0) {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: config.scopes.join(",") },
        })
      }
      const node = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, access.server.nodeId))
          .limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      if (node.daemonPublicKey === null) {
        throw new ApiException("nodes.unreachable", {
          status: 503,
          params: { node: node.name },
        })
      }
      const minted = mintDaemonToken({
        signingKeyHex: node.daemonPublicKey,
        userId: user.id,
        serverId: access.server.id,
        nodeId: node.id,
        scope: granted,
        ttlSeconds: config.ttlSeconds,
      })
      const wsScheme = node.scheme === "https" ? "wss" : "ws"
      const httpScheme = node.scheme === "https" ? "https" : "http"
      const baseUrl = `${node.fqdn}:${node.daemonPort}`
      return c.json({
        token: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
        wsUrl: `${wsScheme}://${baseUrl}/api/servers/${access.server.id}/ws`,
        httpBaseUrl: `${httpScheme}://${baseUrl}`,
        scopes: granted,
      })
    })
}

type ServerAccess = {
  server: typeof serversTable.$inferSelect
  role: "owner" | "subuser" | "admin"
  permissions: string[]
}

const loadServerAccess = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<ServerAccess> => {
  const server = (
    await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.id, serverId))
      .limit(1)
  )[0]
  if (server === undefined) {
    throw new ApiException("servers.not_found", { status: 404 })
  }
  if (user.isAdmin === true) {
    return { server, role: "admin", permissions: [] }
  }
  if (server.ownerId === user.id) {
    return { server, role: "owner", permissions: [] }
  }
  const sub = (
    await db
      .select()
      .from(serverSubusersTable)
      .where(eq(serverSubusersTable.serverId, serverId))
      .limit(1)
  )[0]
  if (sub === undefined || sub.userId !== user.id) {
    throw new ApiException("permissions.denied", { status: 403 })
  }
  return { server, role: "subuser", permissions: sub.permissions }
}
