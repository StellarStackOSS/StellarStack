import { createHmac, timingSafeEqual } from "node:crypto"

import IORedis from "ioredis"
import { Hono } from "hono"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"
import type { NodeWebSocket } from "@hono/node-ws"
import type { WSContext } from "hono/ws"

import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import { serversTable } from "@workspace/db/schema/servers"
import {
  daemonBridgeEnvelopeSchema,
  daemonEnvelopeSchema,
} from "@workspace/daemon-proto/messages"
import { ApiException } from "@workspace/shared/errors"

import type { ApiVariables } from "@/middleware/RequestId"
import type { Env } from "@/env"

const MAX_CLOCK_DRIFT_SECONDS = 60

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const verifyDaemonAuth = async (params: {
  db: Db
  nodeId: string
  timestamp: string
  signature: string
}): Promise<boolean> => {
  const { db, nodeId, timestamp, signature } = params
  const ts = Number.parseInt(timestamp, 10)
  if (Number.isNaN(ts)) {
    return false
  }
  const skew = Math.abs(Math.floor(Date.now() / 1_000) - ts)
  if (skew > MAX_CLOCK_DRIFT_SECONDS) {
    return false
  }
  const rows = await db
    .select({ daemonPublicKey: nodesTable.daemonPublicKey })
    .from(nodesTable)
    .where(eq(nodesTable.id, nodeId))
    .limit(1)
  const row = rows[0]
  if (row === undefined || row.daemonPublicKey === null) {
    return false
  }
  const expected = createHmac("sha256", Buffer.from(row.daemonPublicKey, "hex"))
    .update(`${nodeId}.${timestamp}`)
    .digest()
  let presented: Buffer
  try {
    presented = Buffer.from(signature, "hex")
  } catch {
    return false
  }
  if (presented.length !== expected.length) {
    return false
  }
  return timingSafeEqual(presented, expected)
}

type ConnectedSocket = WSContext<unknown>

/**
 * Daemon-facing WebSocket. Authenticated by an HMAC-SHA256 signature over
 * `${nodeId}.${unixSeconds}` keyed on the per-node signing secret
 * established at pair time.
 *
 * The route is the single bridge between worker processes and connected
 * daemons:
 *
 *  - **Worker → daemon:** the API process subscribes to
 *    `DAEMON_CMD_CHANNEL`. Each `BridgeEnvelope` whose `nodeId` matches a
 *    locally-connected socket is forwarded onto that socket verbatim.
 *  - **Daemon → worker:** every inbound frame is rebroadcast on
 *    `DAEMON_RESP_CHANNEL` so worker correlators can match on
 *    `envelope.id` regardless of which API instance the daemon dialed.
 *  - **Daemon → browser fanout:** state-change and stats frames also flow
 *    onto `PANEL_EVENTS_CHANNEL` for the existing `/events` subscriber.
 */
export const buildDaemonWsRoute = (params: {
  db: Db
  env: Env
  logger: Logger
  redis: IORedis
  upgradeWebSocket: NodeWebSocket["upgradeWebSocket"]
}) => {
  const { db, env, logger, redis, upgradeWebSocket } = params

  const sockets = new Map<string, ConnectedSocket>()
  let cmdSubscriber: IORedis | null = null

  const ensureCmdSubscriber = (): IORedis => {
    if (cmdSubscriber !== null) {
      return cmdSubscriber
    }
    const client = new IORedis(env.REDIS_URL)
    client.subscribe(env.DAEMON_CMD_CHANNEL).catch((err) => {
      logger.error({ err }, "daemon-cmd subscribe failed")
    })
    client.on("message", (_channel, payload) => {
      const parsed = daemonBridgeEnvelopeSchema.safeParse(safeParse(payload))
      if (!parsed.success) {
        logger.warn(
          { issues: parsed.error.issues },
          "Dropping malformed daemon bridge envelope"
        )
        return
      }
      const target = sockets.get(parsed.data.nodeId)
      if (target === undefined || target.readyState !== 1) {
        return
      }
      target.send(JSON.stringify(parsed.data.envelope))
    })
    cmdSubscriber = client
    return client
  }

  return new Hono<{ Variables: ApiVariables }>().get(
    "/",
    upgradeWebSocket(async (c) => {
      const nodeId = c.req.query("node") ?? ""
      const timestamp = c.req.query("ts") ?? ""
      const signature = c.req.query("sig") ?? ""
      const ok = await verifyDaemonAuth({
        db,
        nodeId,
        timestamp,
        signature,
      })
      if (!ok) {
        throw new ApiException("nodes.pair.token_invalid", { status: 401 })
      }
      ensureCmdSubscriber()

      return {
        onOpen: async (_event, ws) => {
          sockets.set(nodeId, ws)
          await db
            .update(nodesTable)
            .set({ connectedAt: new Date() })
            .where(eq(nodesTable.id, nodeId))
          logger.info({ nodeId }, "Daemon connected")
          await redis.publish(
            env.PANEL_EVENTS_CHANNEL,
            JSON.stringify({
              type: "node.daemon.status",
              nodeId,
              connected: true,
              at: new Date().toISOString(),
            })
          )
        },
        onMessage: async (event) => {
          if (typeof event.data !== "string") {
            return
          }
          const parsed = daemonEnvelopeSchema.safeParse(safeParse(event.data))
          if (!parsed.success) {
            logger.warn(
              { nodeId, issues: parsed.error.issues },
              "Dropping malformed daemon frame"
            )
            return
          }

          await redis.publish(
            env.DAEMON_RESP_CHANNEL,
            JSON.stringify({ nodeId, envelope: parsed.data })
          )

          const message = parsed.data.message
          if (message.type === "server.state.changed") {
            const panelPayload = JSON.stringify({
              type: "server.state.changed" as const,
              serverId: message.serverId,
              from: message.from,
              to: message.to,
              reason: message.reason,
              at: message.at,
            })
            // Publish to browsers and persist to DB concurrently so the UI
            // update is not gated on the Postgres round-trip.
            await Promise.all([
              redis.publish(env.PANEL_EVENTS_CHANNEL, panelPayload),
              db
                .update(serversTable)
                .set({ status: message.to, updatedAt: new Date() })
                .where(eq(serversTable.id, message.serverId)),
            ])
          } else if (message.type === "server.stats") {
            await redis.publish(
              env.PANEL_EVENTS_CHANNEL,
              JSON.stringify({
                type: "server.stats" as const,
                serverId: message.serverId,
                memoryBytes: message.memoryBytes,
                memoryLimitBytes: message.memoryLimitBytes,
                cpuFraction: message.cpuFraction,
                diskBytes: message.diskBytes,
                networkRxBytes: message.networkRxBytes,
                networkTxBytes: message.networkTxBytes,
                diskReadBytes: message.diskReadBytes ?? 0,
                diskWriteBytes: message.diskWriteBytes ?? 0,
                at: message.at,
              })
            )
          }
        },
        onClose: async () => {
          sockets.delete(nodeId)
          await db
            .update(nodesTable)
            .set({ connectedAt: null })
            .where(eq(nodesTable.id, nodeId))
          logger.info({ nodeId }, "Daemon disconnected")
          await redis.publish(
            env.PANEL_EVENTS_CHANNEL,
            JSON.stringify({
              type: "node.daemon.status",
              nodeId,
              connected: false,
              at: new Date().toISOString(),
            })
          )
        },
        onError: (_event, ws) => {
          sockets.delete(nodeId)
          ws.close()
        },
      }
    })
  )
}
