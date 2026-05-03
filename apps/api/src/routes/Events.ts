import IORedis from "ioredis"
import { Hono } from "hono"
import { eq, or } from "drizzle-orm"
import type { Logger } from "pino"
import type { WSContext } from "hono/ws"
import type { NodeWebSocket } from "@hono/node-ws"

import { panelEventSchema } from "@workspace/shared/events"
import type { Db } from "@workspace/db/client.types"
import {
  serverSubusersTable,
  serversTable,
} from "@workspace/db/schema/servers"
import { nodesTable } from "@workspace/db/schema/nodes"

import type { Env } from "@/env"
import type { Auth } from "@/auth"
import { buildRequireSession, type AuthVariables } from "@/middleware/RequireSession"

type WSContextAny = WSContext<unknown>

/**
 * Build the panel-event WS route. The browser opens one socket per session
 * to `/events`; each socket subscribes to the shared Redis pub/sub channel
 * and forwards every validated `PanelEvent` to the client. Direct-to-daemon
 * channels (console, stats, SFTP) intentionally bypass this fanout.
 */
export const buildEventsRoute = (params: {
  auth: Auth
  db: Db
  env: Env
  logger: Logger
  upgradeWebSocket: NodeWebSocket["upgradeWebSocket"]
}) => {
  const { auth, db, env, logger, upgradeWebSocket } = params
  const requireSession = buildRequireSession(auth)

  const sockets = new Set<WSContextAny>()
  let subscriber: IORedis | null = null

  const ensureSubscriber = (): IORedis => {
    if (subscriber !== null) {
      return subscriber
    }
    const client = new IORedis(env.REDIS_URL)
    client.subscribe(env.PANEL_EVENTS_CHANNEL).catch((err) => {
      logger.error({ err }, "panel-event subscribe failed")
    })
    client.on("message", (_channel, payload) => {
      const parsed = panelEventSchema.safeParse(safeJsonParse(payload))
      if (!parsed.success) {
        logger.warn(
          { issues: parsed.error.issues },
          "Dropping malformed panel-event payload"
        )
        return
      }
      const frame = JSON.stringify(parsed.data)
      for (const ws of sockets) {
        if (ws.readyState === 1) {
          ws.send(frame)
        }
      }
    })
    subscriber = client
    return client
  }

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", requireSession)
    .get(
      "/",
      upgradeWebSocket(async (c) => {
        ensureSubscriber()
        const user = c.get("user")
        const userId = user.id
        const isAdmin = user.isAdmin === true
        return {
          onOpen: async (_event, ws) => {
            sockets.add(ws)
            // Push a snapshot of every accessible server's current state and
            // every relevant node's daemon-connected flag so a browser that
            // joined after the last transition still renders the correct
            // status without waiting for the next event.
            try {
              await sendSnapshot({ db, ws, userId, isAdmin })
            } catch (err) {
              logger.warn({ err }, "panel-event snapshot failed")
            }
          },
          onClose: (_event, ws) => {
            sockets.delete(ws)
          },
          onError: (_event, ws) => {
            sockets.delete(ws)
          },
        }
      })
    )
}

const sendSnapshot = async (params: {
  db: Db
  ws: WSContextAny
  userId: string
  isAdmin: boolean
}): Promise<void> => {
  const { db, ws, userId, isAdmin } = params

  const ownedServers = isAdmin
    ? await db
        .select({
          id: serversTable.id,
          status: serversTable.status,
          nodeId: serversTable.nodeId,
        })
        .from(serversTable)
    : await db
        .select({
          id: serversTable.id,
          status: serversTable.status,
          nodeId: serversTable.nodeId,
        })
        .from(serversTable)
        .leftJoin(
          serverSubusersTable,
          eq(serverSubusersTable.serverId, serversTable.id)
        )
        .where(
          or(
            eq(serversTable.ownerId, userId),
            eq(serverSubusersTable.userId, userId)
          )
        )

  const seen = new Set<string>()
  const nodeIds = new Set<string>()
  const at = new Date().toISOString()
  for (const row of ownedServers) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    nodeIds.add(row.nodeId)
    if (ws.readyState !== 1) return
    ws.send(
      JSON.stringify({
        type: "server.state.changed",
        serverId: row.id,
        from: row.status,
        to: row.status,
        reason: { code: "servers.lifecycle.snapshot" },
        at,
      })
    )
  }

  if (nodeIds.size > 0) {
    const nodes = await db
      .select({
        id: nodesTable.id,
        connectedAt: nodesTable.connectedAt,
      })
      .from(nodesTable)
    for (const n of nodes) {
      if (!nodeIds.has(n.id)) continue
      if (ws.readyState !== 1) return
      ws.send(
        JSON.stringify({
          type: "node.daemon.status",
          nodeId: n.id,
          connected: n.connectedAt !== null,
          at,
        })
      )
    }
  }
}

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
