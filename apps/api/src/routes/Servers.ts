import { Hono } from "hono"
import { and, eq, isNull, sum } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import { blueprintsTable } from "@workspace/db/schema/blueprints"
import {
  nodeAllocationsTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import {
  serverAllocationsTable,
  serverSubusersTable,
  serverVariablesTable,
  serversTable,
} from "@workspace/db/schema/servers"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import {
  filterScopes,
  loadServerAccess,
  requireScope,
} from "@/access"
import { clientIp, writeAudit } from "@/audit"
import type { Auth } from "@/auth"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"
import type { Queues } from "@/queues"
import { mintDaemonToken } from "@/tokens"

const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(255).optional(),
  blueprintId: z.string().uuid(),
  nodeId: z.string().uuid(),
  dockerImage: z.string().min(1),
  memoryLimitMb: z.number().int().positive().max(1_048_576),
  cpuLimitPercent: z.number().int().positive().max(10_000),
  diskLimitMb: z.number().int().positive().max(10_485_760),
  variables: z.record(z.string(), z.string()).default({}),
})

/**
 * Server CRUD + provisioning. POST /servers picks the next free allocation
 * on the requested node inside a transaction so two concurrent provisions
 * can never claim the same `(nodeId, ip, port)`. Once the row is committed
 * with `status = "installing"` an entry on the server.install queue drives
 * the rest of the flow asynchronously.
 */
export const buildServersRoute = (params: {
  auth: Auth
  db: Db
  queues: Queues
}) => {
  const { auth, db, queues } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/", async (c) => {
      const user = c.get("user")
      if (user.isAdmin === true) {
        const rows = await db.select().from(serversTable)
        return c.json({ servers: rows })
      }
      const ownedRows = await db
        .select()
        .from(serversTable)
        .where(eq(serversTable.ownerId, user.id))
      const subuserRows = await db
        .select({ server: serversTable })
        .from(serverSubusersTable)
        .innerJoin(
          serversTable,
          eq(serverSubusersTable.serverId, serversTable.id)
        )
        .where(eq(serverSubusersTable.userId, user.id))
      const seen = new Set<string>()
      const merged: typeof ownedRows = []
      for (const row of ownedRows) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          merged.push(row)
        }
      }
      for (const { server } of subuserRows) {
        if (!seen.has(server.id)) {
          seen.add(server.id)
          merged.push(server)
        }
      }
      return c.json({ servers: merged })
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      return c.json({
        server: access.server,
        access: { role: access.role, permissions: access.permissions },
      })
    })
    .post("/", async (c) => {
      const parsed = createServerSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const user = c.get("user")
      const input = parsed.data

      const blueprint = (
        await db
          .select()
          .from(blueprintsTable)
          .where(eq(blueprintsTable.id, input.blueprintId))
          .limit(1)
      )[0]
      if (blueprint === undefined) {
        throw new ApiException("blueprints.not_found", { status: 404 })
      }
      if (!Object.values(blueprint.dockerImages).includes(input.dockerImage)) {
        throw apiValidationError(
          new z.ZodError([
            {
              code: "invalid_value",
              path: ["dockerImage"],
              message: "Image must be declared in the blueprint",
              input: input.dockerImage,
              values: Object.values(blueprint.dockerImages),
            },
          ])
        )
      }

      const node = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, input.nodeId))
          .limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }

      const usedRow = (
        await db
          .select({
            memoryUsed: sum(serversTable.memoryLimitMb),
            diskUsed: sum(serversTable.diskLimitMb),
          })
          .from(serversTable)
          .where(eq(serversTable.nodeId, input.nodeId))
      )[0]
      const memoryUsed = Number(usedRow?.memoryUsed ?? 0)
      const diskUsed = Number(usedRow?.diskUsed ?? 0)
      if (memoryUsed + input.memoryLimitMb > node.memoryTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: {
            node: node.name,
            available: node.memoryTotalMb - memoryUsed,
            requested: input.memoryLimitMb,
          },
        })
      }
      if (diskUsed + input.diskLimitMb > node.diskTotalMb) {
        throw new ApiException("servers.create.node_at_capacity", {
          status: 409,
          params: {
            node: node.name,
            available: node.diskTotalMb - diskUsed,
            requested: input.diskLimitMb,
          },
        })
      }

      const serverRow = await db.transaction(async (tx) => {
        const allocationRow = (
          await tx
            .select()
            .from(nodeAllocationsTable)
            .where(
              and(
                eq(nodeAllocationsTable.nodeId, input.nodeId),
                isNull(nodeAllocationsTable.serverId)
              )
            )
            .limit(1)
            .for("update")
        )[0]
        if (allocationRow === undefined) {
          throw new ApiException("servers.create.no_free_allocation", {
            status: 409,
          })
        }

        const inserted = await tx
          .insert(serversTable)
          .values({
            ownerId: user.id,
            nodeId: input.nodeId,
            blueprintId: input.blueprintId,
            primaryAllocationId: allocationRow.id,
            name: input.name,
            description: input.description ?? null,
            memoryLimitMb: input.memoryLimitMb,
            cpuLimitPercent: input.cpuLimitPercent,
            diskLimitMb: input.diskLimitMb,
            dockerImage: input.dockerImage,
            status: "installing",
            suspended: false,
          })
          .returning()
        const created = inserted[0]
        if (created === undefined) {
          throw new ApiException("internal.unexpected", { status: 500 })
        }

        await tx
          .update(nodeAllocationsTable)
          .set({ serverId: created.id })
          .where(eq(nodeAllocationsTable.id, allocationRow.id))

        await tx.insert(serverAllocationsTable).values({
          serverId: created.id,
          allocationId: allocationRow.id,
        })

        const variableRows = blueprint.variables.map((variable) => ({
          serverId: created.id,
          variableKey: variable.key,
          value: input.variables[variable.key] ?? variable.default,
        }))
        if (variableRows.length > 0) {
          await tx.insert(serverVariablesTable).values(variableRows)
        }

        return created
      })

      await queues.serverInstall.add(
        "install",
        { serverId: serverRow.id },
        { removeOnComplete: 100, removeOnFail: 100 }
      )

      writeAudit({
        db,
        actorId: user.id,
        ip: clientIp(c),
        action: "server.create",
        targetType: "server",
        targetId: serverRow.id,
        metadata: { name: serverRow.name, nodeId: serverRow.nodeId },
      })

      return c.json({ server: serverRow }, 201)
    })
    .post("/:id/power", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const parsed = z
        .object({ action: z.enum(["start", "stop", "restart", "kill"]) })
        .safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const access = await loadServerAccess(db, user, id)
      requireScope(access, "console.write")
      if (access.server.suspended) {
        throw new ApiException("servers.action.suspended", { status: 403 })
      }
      await queues.serverPower.add(
        "power",
        { serverId: access.server.id, action: parsed.data.action },
        { removeOnComplete: 100, removeOnFail: 100 }
      )
      return c.json({ ok: true })
    })
    .post("/:id/ws-credentials", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      const scope = filterScopes(access, [
        "console.read",
        "console.write",
        "stats.read",
      ])
      if (scope.length === 0) {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "console.read" },
        })
      }
      const node = await loadNode(db, access.server.nodeId)
      const minted = await mintDaemonToken({
        signingKeyHex: node.daemonPublicKey ?? "",
        userId: user.id,
        serverId: access.server.id,
        nodeId: node.id,
        scope,
        ttlSeconds: 60,
      })
      return c.json({
        token: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
        wsUrl: `${node.scheme === "https" ? "wss" : "ws"}://${node.fqdn}:${node.daemonPort}/servers/${access.server.id}/ws`,
      })
    })
    .post("/:id/files-credentials", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      const scope = filterScopes(access, [
        "files.read",
        "files.write",
        "files.delete",
      ])
      if (scope.length === 0) {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "files.read" },
        })
      }
      const node = await loadNode(db, access.server.nodeId)
      const minted = await mintDaemonToken({
        signingKeyHex: node.daemonPublicKey ?? "",
        userId: user.id,
        serverId: access.server.id,
        nodeId: node.id,
        scope,
        ttlSeconds: 300,
      })
      return c.json({
        token: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
        baseUrl: `${node.scheme}://${node.fqdn}:${node.daemonPort}/servers/${access.server.id}`,
      })
    })
    .post("/:id/sftp-credentials", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      requireScope(access, "sftp")
      const node = await loadNode(db, access.server.nodeId)
      const minted = await mintDaemonToken({
        signingKeyHex: node.daemonPublicKey ?? "",
        userId: user.id,
        serverId: access.server.id,
        nodeId: node.id,
        scope: ["sftp"],
        ttlSeconds: 24 * 60 * 60,
      })
      return c.json({
        host: node.fqdn,
        port: node.sftpPort,
        username: `${user.id}.${access.server.id}`,
        password: minted.token,
        expiresAt: minted.expiresAt.toISOString(),
      })
    })
    .patch("/:id/suspend", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      if (user.isAdmin !== true) {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "admin" },
        })
      }
      const parsed = z
        .object({ suspended: z.boolean() })
        .safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      await loadServerAccess(db, user, id)
      await db
        .update(serversTable)
        .set({ suspended: parsed.data.suspended, updatedAt: new Date() })
        .where(eq(serversTable.id, id))
      writeAudit({
        db,
        actorId: user.id,
        ip: clientIp(c),
        action: parsed.data.suspended ? "server.suspend" : "server.unsuspend",
        targetType: "server",
        targetId: id,
      })
      return c.json({ ok: true })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const access = await loadServerAccess(db, user, id)
      if (access.role === "subuser") {
        throw new ApiException("permissions.denied", {
          status: 403,
          params: { statement: "server.delete" },
        })
      }
      await queues.serverPower.add(
        "power",
        { serverId: id, action: "kill" },
        { removeOnComplete: 100, removeOnFail: 100 }
      )
      await db
        .update(nodeAllocationsTable)
        .set({ serverId: null })
        .where(eq(nodeAllocationsTable.serverId, id))
      await db.delete(serversTable).where(eq(serversTable.id, id))
      writeAudit({
        db,
        actorId: user.id,
        ip: clientIp(c),
        action: "server.delete",
        targetType: "server",
        targetId: id,
        metadata: { name: access.server.name },
      })
      return c.json({ ok: true })
    })
}

const loadNode = async (db: Db, nodeId: string) => {
  const node = (
    await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.id, nodeId))
      .limit(1)
  )[0]
  if (node === undefined || node.daemonPublicKey === null) {
    throw new ApiException("nodes.not_found", { status: 404 })
  }
  return node
}

