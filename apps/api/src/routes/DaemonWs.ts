import { createHmac, timingSafeEqual } from "node:crypto"

import { Hono } from "hono"
import { eq } from "drizzle-orm"
import type IORedis from "ioredis"
import type { Logger } from "pino"
import type { NodeWebSocket } from "@hono/node-ws"

import type { Db } from "@workspace/db/client.types"
import { nodesTable } from "@workspace/db/schema/nodes"
import { daemonEnvelopeSchema } from "@workspace/daemon-proto/messages"
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

/**
 * Daemon-facing WebSocket. Authenticated by an HMAC-SHA256 signature over
 * `${nodeId}.${unixSeconds}` keyed on the per-node signing secret
 * established at pair time. The daemon sends the node id, timestamp, and
 * signature as query params so the upgrade can be authenticated before any
 * frame is exchanged.
 *
 * Once the socket is open the daemon emits a `daemon.hello` envelope; the
 * route updates `nodes.connected_at`, then forwards every state-change /
 * stats / log frame onto the panel pub/sub channel where the browser-facing
 * /events route picks it up.
 */
export const buildDaemonWsRoute = (params: {
  db: Db
  env: Env
  logger: Logger
  redis: IORedis
  upgradeWebSocket: NodeWebSocket["upgradeWebSocket"]
}) => {
  const { db, env, logger, redis, upgradeWebSocket } = params

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

      return {
        onOpen: async () => {
          await db
            .update(nodesTable)
            .set({ connectedAt: new Date() })
            .where(eq(nodesTable.id, nodeId))
          logger.info({ nodeId }, "Daemon connected")
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
          const message = parsed.data.message
          if (
            message.type === "server.state_changed" ||
            message.type === "server.stats"
          ) {
            const event =
              message.type === "server.state_changed"
                ? {
                    type: "server.state.changed" as const,
                    serverId: message.serverId,
                    from: message.from,
                    to: message.to,
                    reason: message.reason,
                    at: message.at,
                  }
                : {
                    type: "server.stats" as const,
                    serverId: message.serverId,
                    memoryBytes: message.memoryBytes,
                    memoryLimitBytes: message.memoryLimitBytes,
                    cpuFraction: message.cpuFraction,
                    diskBytes: message.diskBytes,
                    networkRxBytes: message.networkRxBytes,
                    networkTxBytes: message.networkTxBytes,
                    at: message.at,
                  }
            await redis.publish(
              env.PANEL_EVENTS_CHANNEL,
              JSON.stringify(event)
            )
          }
        },
        onClose: async () => {
          await db
            .update(nodesTable)
            .set({ connectedAt: null })
            .where(eq(nodesTable.id, nodeId))
          logger.info({ nodeId }, "Daemon disconnected")
        },
        onError: (_event, ws) => {
          ws.close()
        },
      }
    })
  )
}
