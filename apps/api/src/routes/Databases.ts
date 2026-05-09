import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  databaseHostsTable,
  databasesTable,
} from "@workspace/db/schema/databases"
import { nodeAllocationsTable, nodesTable } from "@workspace/db/schema/nodes"
import {
  serverSubusersTable,
  serversTable,
} from "@workspace/db/schema/servers"
import {
  DATABASE_TYPES,
  isDatabaseTypeKey,
  substituteDatabaseScript,
} from "@workspace/shared/databases"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { Env } from "@/env"
import {
  decryptSecret,
  encryptSecret,
  generatePassword,
} from "@/lib/Crypto"
import { callDaemon } from "@/lib/DaemonHttp"
import {
  buildRequireSession,
  type AuthVariables,
} from "@/middleware/RequireSession"

const createSchema = z.object({
  hostId: z.string().uuid(),
  name: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-zA-Z0-9_]+$/, "name must be alphanumeric or underscore")
    .optional(),
})

const sanitize = (s: string): string => s.replace(/[^a-zA-Z0-9_]/g, "_")

const loadAccessibleServer = async (
  db: Db,
  user: { id: string; isAdmin?: boolean | null },
  serverId: string
): Promise<typeof serversTable.$inferSelect> => {
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
  if (user.isAdmin === true) return server
  if (server.ownerId === user.id) return server
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
  return server
}

export const buildDatabasesRoute = (params: {
  auth: Auth
  db: Db
  env: Env
}) => {
  const { auth, db, env } = params
  const requireSession = buildRequireSession(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get("/:id/databases/hosts", async (c) => {
      // Lists database hosts the user can attach to: shared + running +
      // on the same node as the game server. Cross-node attachment is
      // disallowed because the panel only allocates ports on the local
      // node and we don't proxy traffic between hosts.
      const id = c.req.param("id")
      const user = c.get("user")
      const server = await loadAccessibleServer(db, user, id)
      const rows = await db
        .select({
          id: databaseHostsTable.id,
          name: databaseHostsTable.name,
          dbType: databaseHostsTable.dbType,
          status: databaseHostsTable.status,
          shared: databaseHostsTable.shared,
          suspended: databaseHostsTable.suspended,
        })
        .from(databaseHostsTable)
        .where(
          and(
            eq(databaseHostsTable.shared, true),
            eq(databaseHostsTable.nodeId, server.nodeId)
          )
        )
      return c.json({
        hosts: rows.filter((r) => r.status === "running" && !r.suspended),
      })
    })
    .get("/:id/databases", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      await loadAccessibleServer(db, user, id)
      const rows = await db
        .select({
          id: databasesTable.id,
          name: databasesTable.name,
          username: databasesTable.username,
          createdAt: databasesTable.createdAt,
          hostId: databaseHostsTable.id,
          hostName: databaseHostsTable.name,
          hostDbType: databaseHostsTable.dbType,
          nodeFqdn: nodesTable.fqdn,
          allocationPort: nodeAllocationsTable.port,
          passwordEncrypted: databasesTable.passwordEncrypted,
        })
        .from(databasesTable)
        .innerJoin(
          databaseHostsTable,
          eq(databaseHostsTable.id, databasesTable.hostId)
        )
        .leftJoin(nodesTable, eq(nodesTable.id, databaseHostsTable.nodeId))
        .leftJoin(
          nodeAllocationsTable,
          eq(nodeAllocationsTable.id, databaseHostsTable.allocationId)
        )
        .where(eq(databasesTable.serverId, id))

      const databases = rows.map((row) => {
        const password = decryptSecret(
          row.passwordEncrypted,
          env.BETTER_AUTH_SECRET
        )
        const type = isDatabaseTypeKey(row.hostDbType)
          ? DATABASE_TYPES[row.hostDbType]
          : null
        const connectionString =
          type !== null && row.nodeFqdn !== null && row.allocationPort !== null
            ? type.connectionString({
                host: row.nodeFqdn,
                port: row.allocationPort,
                db: row.name,
                user: row.username,
                password,
              })
            : ""
        return {
          id: row.id,
          name: row.name,
          username: row.username,
          password,
          createdAt: row.createdAt,
          host: {
            id: row.hostId,
            name: row.hostName,
            dbType: row.hostDbType,
            driver: type?.driver ?? "unknown",
            address:
              row.nodeFqdn !== null && row.allocationPort !== null
                ? `${row.nodeFqdn}:${row.allocationPort}`
                : "",
          },
          connectionString,
        }
      })
      return c.json({ databases })
    })
    .post("/:id/databases", async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const server = await loadAccessibleServer(db, user, id)
      if (user.isAdmin !== true && server.ownerId !== user.id) {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const parsed = createSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const input = parsed.data

      const host = (
        await db
          .select()
          .from(databaseHostsTable)
          .where(eq(databaseHostsTable.id, input.hostId))
          .limit(1)
      )[0]
      if (host === undefined) {
        throw new ApiException("databases.host_not_found", { status: 404 })
      }
      if (host.status !== "running" || host.suspended) {
        throw new ApiException("databases.host_not_running", { status: 409 })
      }
      if (!host.shared && user.isAdmin !== true) {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      // Users can only attach to a host that lives on the same node as
      // their server — same constraint the GET /hosts endpoint enforces.
      if (host.nodeId !== server.nodeId && user.isAdmin !== true) {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      if (!isDatabaseTypeKey(host.dbType)) {
        throw new ApiException("databases.unknown_type", { status: 422 })
      }
      const type = DATABASE_TYPES[host.dbType]

      const node = (
        await db
          .select()
          .from(nodesTable)
          .where(eq(nodesTable.id, host.nodeId))
          .limit(1)
      )[0]
      if (node === undefined || node.daemonPublicKey === null) {
        throw new ApiException("nodes.not_paired", { status: 409 })
      }

      // Names: if not supplied, derive `s_<short>_<n>` so multiple
      // databases on one server don't collide.
      const baseName =
        input.name ?? `s_${id.slice(0, 8)}_${Math.floor(Date.now() / 1000)}`
      const dbName = sanitize(baseName).slice(0, 32)
      const username = sanitize(`u_${baseName}`).slice(0, 32)
      const password = generatePassword(20)
      const rootPass = decryptSecret(
        host.rootPasswordEncrypted,
        env.BETTER_AUTH_SECRET
      )

      const script = substituteDatabaseScript(type.provisionScript, {
        root: type.rootUser,
        rootPass,
        db: dbName,
        user: username,
        password,
      })

      const execRes = await callDaemon({
        baseUrl: `${node.scheme}://${node.fqdn}:${node.daemonPort}`,
        nodeId: node.id,
        signingKeyHex: node.daemonPublicKey,
        method: "POST",
        path: `/api/databases/${host.id}/exec`,
        body: { cmd: ["sh", "-c", script] },
      })
      if (!execRes.ok) {
        throw new ApiException("databases.provision_failed", { status: 502 })
      }
      const execBody = (await execRes.json()) as {
        exit_code: number
        stdout: string
        stderr: string
      }
      if (execBody.exit_code !== 0) {
        console.error("databases provision exec failed", execBody)
        throw new ApiException("databases.provision_failed", { status: 502 })
      }

      const [row] = await db
        .insert(databasesTable)
        .values({
          hostId: host.id,
          serverId: server.id,
          createdById: user.id,
          name: dbName,
          username,
          passwordEncrypted: encryptSecret(password, env.BETTER_AUTH_SECRET),
        })
        .returning()
      if (row === undefined) throw new Error("insert failed")

      return c.json({ database: row })
    })
    .delete("/:id/databases/:dbId", async (c) => {
      const id = c.req.param("id")
      const dbId = c.req.param("dbId")
      const user = c.get("user")
      const server = await loadAccessibleServer(db, user, id)
      if (user.isAdmin !== true && server.ownerId !== user.id) {
        throw new ApiException("permissions.denied", { status: 403 })
      }
      const row = (
        await db
          .select()
          .from(databasesTable)
          .where(
            and(
              eq(databasesTable.id, dbId),
              eq(databasesTable.serverId, server.id)
            )
          )
          .limit(1)
      )[0]
      if (row === undefined) {
        throw new ApiException("databases.not_found", { status: 404 })
      }
      const host = (
        await db
          .select()
          .from(databaseHostsTable)
          .where(eq(databaseHostsTable.id, row.hostId))
          .limit(1)
      )[0]
      if (host !== undefined && isDatabaseTypeKey(host.dbType)) {
        const node = (
          await db
            .select()
            .from(nodesTable)
            .where(eq(nodesTable.id, host.nodeId))
            .limit(1)
        )[0]
        if (node !== undefined && node.daemonPublicKey !== null) {
          const type = DATABASE_TYPES[host.dbType]
          const rootPass = decryptSecret(
            host.rootPasswordEncrypted,
            env.BETTER_AUTH_SECRET
          )
          const script = substituteDatabaseScript(type.dropScript, {
            root: type.rootUser,
            rootPass,
            db: row.name,
            user: row.username,
            password: "",
          })
          try {
            await callDaemon({
              baseUrl: `${node.scheme}://${node.fqdn}:${node.daemonPort}`,
              nodeId: node.id,
              signingKeyHex: node.daemonPublicKey,
              method: "POST",
              path: `/api/databases/${host.id}/exec`,
              body: { cmd: ["sh", "-c", script] },
            })
          } catch (err) {
            console.warn(`database ${dbId}: drop exec failed`, err)
          }
        }
      }
      await db.delete(databasesTable).where(eq(databasesTable.id, dbId))
      return c.json({ ok: true })
    })
}
