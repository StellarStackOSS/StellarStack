import { and, eq, isNull, or, sum } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serverSubusersTable,
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { ApiException, apiValidationError } from "@workspace/shared/errors"
import type { DaemonJwtScope } from "@workspace/shared/jwt.types"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import { writeAudit } from "@/lib/Audit"
import type { InstallRunner } from "@/lib/InstallRunner"
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

const createServerSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  nodeId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  dockerImage: z.string().min(1),
  primaryAllocationId: z.string().uuid(),
  memoryLimitMb: z.number().int().positive(),
  cpuLimitPercent: z.number().int().positive(),
  diskLimitMb: z.number().int().positive(),
  startupExtra: z.string().optional(),
  variables: z.record(z.string(), z.string()).default({}),
})

/**
 * Server CRUD + the credentials endpoint that mints the per-node JWT
 * the browser uses to dial the daemon directly.
 */
export const buildServersRoute = (params: {
  auth: Auth
  db: Db
  env: Env
  installRunner: InstallRunner
  statusCache: StatusCache
}) => {
  const { auth, db, env, installRunner, statusCache } = params
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
    .patch("/:id", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const body = await c.req.json()
      const schema = z.object({
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
      })
      const parsed = schema.safeParse(body)
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db
        .update(serversTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true })
    })
    .get("/:id/variables", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      const [variables, blueprint] = await Promise.all([
        db
          .select()
          .from(serverVariablesTable)
          .where(eq(serverVariablesTable.serverId, id)),
        db
          .select({
            variables: blueprintsTable.variables,
            startupCommand: blueprintsTable.startupCommand,
            dockerImages: blueprintsTable.dockerImages,
          })
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, access.server.blueprintId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ])
      return c.json({
        variables,
        startupExtra: access.server.startupExtra,
        dockerImage: access.server.dockerImage,
        blueprint,
      })
    })
    .patch("/:id/variables", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const schema = z.object({
        variables: z.record(z.string(), z.string()),
      })
      const parsed = schema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db.transaction(async (tx) => {
        for (const [key, value] of Object.entries(parsed.data.variables)) {
          await tx
            .insert(serverVariablesTable)
            .values({ serverId: id, variableKey: key, value })
            .onConflictDoUpdate({
              target: [
                serverVariablesTable.serverId,
                serverVariablesTable.variableKey,
              ],
              set: { value },
            })
        }
      })
      return c.json({ ok: true })
    })
    .patch("/:id/startup", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const schema = z.object({ startupExtra: z.string().nullable() })
      const parsed = schema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      await db
        .update(serversTable)
        .set({ startupExtra: parsed.data.startupExtra, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true })
    })
    .patch("/:id/blueprint", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const schema = z.object({
        blueprintId: z.string().uuid(),
        dockerImage: z.string().min(1),
      })
      const parsed = schema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const blueprint = (
        await db
          .select({ dockerImages: blueprintsTable.dockerImages })
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, parsed.data.blueprintId))
          .limit(1)
      )[0]
      if (blueprint === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      if (!Object.values(blueprint.dockerImages).includes(parsed.data.dockerImage)) {
        throw new ApiException("servers.startup.invalid_docker_image", {
          status: 422,
        })
      }
      await db
        .update(serversTable)
        .set({
          blueprintId: parsed.data.blueprintId,
          dockerImage: parsed.data.dockerImage,
          installState: "pending",
          updatedAt: new Date(),
        })
        .where(eq(serversTable.id, id))
      // Drop the old per-server variables; the new blueprint owns the
      // schema. Owners can refill them from the StartupTab.
      await db
        .delete(serverVariablesTable)
        .where(eq(serverVariablesTable.serverId, id))
      void writeAudit({
        db,
        actorId: user.id,
        action: "servers.blueprint_changed",
        targetType: "server",
        targetId: id,
        metadata: { blueprintId: parsed.data.blueprintId },
      })
      return c.json({ ok: true })
    })
    .patch("/:id/docker-image", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const schema = z.object({ dockerImage: z.string().min(1) })
      const parsed = schema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const blueprint = (
        await db
          .select({ dockerImages: blueprintsTable.dockerImages })
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, access.server.blueprintId))
          .limit(1)
      )[0]
      if (
        blueprint === undefined ||
        !Object.values(blueprint.dockerImages).includes(parsed.data.dockerImage)
      ) {
        throw new ApiException("servers.startup.invalid_docker_image", {
          status: 422,
        })
      }
      await db
        .update(serversTable)
        .set({ dockerImage: parsed.data.dockerImage, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      return c.json({ ok: true })
    })
    .post("/:id/reinstall", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      await db
        .update(serversTable)
        .set({ installState: "pending", updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      void installRunner.enqueue(access.server.id)
      return c.json({ ok: true })
    })
    .post("/", async (c) => {
      const user = c.get("user")
      const parsed = createServerSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const input = parsed.data

      const [blueprint, node, allocation] = await Promise.all([
        db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, input.blueprintId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, input.nodeId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(nodeAllocationsTable)
          .where(
            and(
              eq(nodeAllocationsTable.id, input.primaryAllocationId),
              eq(nodeAllocationsTable.nodeId, input.nodeId),
              isNull(nodeAllocationsTable.serverId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]),
      ])
      if (blueprint === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      if (allocation === undefined) {
        throw new ApiException("servers.create.allocation_unavailable", {
          status: 409,
        })
      }
      if (!Object.values(blueprint.dockerImages).includes(input.dockerImage)) {
        throw new ApiException("servers.startup.invalid_docker_image", {
          status: 422,
        })
      }
      const usage = (
        await db
          .select({
            memoryUsed: sum(serversTable.memoryLimitMb),
            diskUsed: sum(serversTable.diskLimitMb),
          })
          .from(serversTable)
          .where(eq(serversTable.nodeId, input.nodeId))
      )[0]
      const memoryUsed = Number(usage?.memoryUsed ?? 0)
      const diskUsed = Number(usage?.diskUsed ?? 0)
      if (memoryUsed + input.memoryLimitMb > node.memoryTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: { node: node.name },
        })
      }
      if (diskUsed + input.diskLimitMb > node.diskTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: { node: node.name },
        })
      }

      const inserted = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(serversTable)
          .values({
            ownerId: user.id,
            nodeId: input.nodeId,
            blueprintId: input.blueprintId,
            primaryAllocationId: input.primaryAllocationId,
            name: input.name,
            description: input.description ?? null,
            memoryLimitMb: input.memoryLimitMb,
            cpuLimitPercent: input.cpuLimitPercent,
            diskLimitMb: input.diskLimitMb,
            dockerImage: input.dockerImage,
            startupExtra: input.startupExtra ?? null,
            status: "offline",
            installState: "pending",
          })
          .returning()
        if (row === undefined) throw new Error("insert failed")

        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: row.id })
          .where(eq(nodeAllocationsTable.id, input.primaryAllocationId))
        await tx.insert(serverAllocationsTable).values({
          serverId: row.id,
          allocationId: input.primaryAllocationId,
        })

        const variableRows = Object.entries(input.variables).map(
          ([key, value]) => ({ serverId: row.id, variableKey: key, value })
        )
        if (variableRows.length > 0) {
          await tx.insert(serverVariablesTable).values(variableRows)
        }
        return row
      })

      // Fire the install in the background; client polls /servers/:id/install.
      void installRunner.enqueue(inserted.id)
      void writeAudit({
        db,
        actorId: user.id,
        action: "servers.created",
        targetType: "server",
        targetId: inserted.id,
        metadata: { name: inserted.name },
      })
      return c.json({ server: inserted })
    })
    .get("/:id/install", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      await loadServerAccess(db, user, id)
      const job = installRunner.get(id)
      if (job === undefined) {
        // Process restart loses the in-memory job; fall back to persisted
        // log lines so the panel can keep rendering history. The
        // server's `installState` column gives the terminal verdict.
        const persisted = await installRunner.logsFromDb(id)
        return c.json({ state: "unknown", log: persisted })
      }
      return c.json({
        state: job.state,
        startedAt: job.startedAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        exitCode: job.exitCode,
        log: job.log,
      })
    })
    .post("/:id/install/retry", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      await installRunner.enqueue(id)
      return c.json({ ok: true })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role !== "owner" && access.role !== "admin") {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      await db.transaction(async (tx) => {
        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: null })
          .where(eq(nodeAllocationsTable.serverId, id))
        await tx.delete(serversTable).where(eq(serversTable.id, id))
      })
      await statusCache.set(id, "offline")
      void writeAudit({
        db,
        actorId: user.id,
        action: "servers.deleted",
        targetType: "server",
        targetId: id,
      })
      return c.json({ ok: true })
    })
    .post("/:id/files-credentials", async (c) => {
      // Alias matching the existing useFiles hook contract: returns
      // `{ token, expiresAt, baseUrl }` (no wsUrl). The token carries
      // every files.* scope the user has on this server.
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
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
      const allowedSet = new Set<DaemonJwtScope>(
        access.permissions as DaemonJwtScope[]
      )
      const filesScopes: DaemonJwtScope[] = [
        "files.read",
        "files.write",
        "files.delete",
      ]
      const granted: DaemonJwtScope[] = filesScopes.filter(
        (s) => access.role === "owner" || access.role === "admin" || allowedSet.has(s)
      )
      if (granted.length === 0) {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "files.read" },
        })
      }
      const minted = mintDaemonToken({
        signingKeyHex: node.daemonPublicKey,
        userId: user.id,
        serverId: access.server.id,
        nodeId: node.id,
        scope: granted,
        ttlSeconds: 600,
      })
      const httpScheme = node.scheme === "https" ? "https" : "http"
      return c.json({
        token: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
        // baseUrl is the per-server root; the hook concatenates "/files",
        // "/files/content", etc. The daemon recognises those path
        // suffixes and maps (path+method) → op internally.
        baseUrl: `${httpScheme}://${node.fqdn}:${node.daemonPort}/api/servers/${access.server.id}`,
      })
    })
    .post("/:id/sftp-credentials", async (c) => {
      // Alias matching the existing useSftpCredentials hook contract:
      // returns { host, port, username, password (=JWT), expiresAt }.
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
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
      if (
        access.role !== "owner" &&
        access.role !== "admin" &&
        !(access.permissions as DaemonJwtScope[]).includes("sftp")
      ) {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const minted = mintDaemonToken({
        signingKeyHex: node.daemonPublicKey,
        userId: user.id,
        serverId: access.server.id,
        nodeId: node.id,
        scope: ["sftp"],
        ttlSeconds: 86_400,
      })
      return c.json({
        host: node.fqdn,
        port: node.sftpPort,
        username: `${user.id}.${access.server.id}`,
        password: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
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
      const sftp =
        parsed.data.purpose === "sftp"
          ? {
              host: node.fqdn,
              port: node.sftpPort,
              username: `${user.id}.${access.server.id}`,
            }
          : null
      return c.json({
        token: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
        wsUrl: `${wsScheme}://${baseUrl}/api/servers/${access.server.id}/ws`,
        httpBaseUrl: `${httpScheme}://${baseUrl}`,
        scopes: granted,
        sftp,
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
