import IORedis from "ioredis"
import { Hono } from "hono"
import type { Logger } from "pino"
import type { WSContext } from "hono/ws"
import type { NodeWebSocket } from "@hono/node-ws"

import { panelEventSchema } from "@workspace/shared/events"

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
  env: Env
  logger: Logger
  upgradeWebSocket: NodeWebSocket["upgradeWebSocket"]
}) => {
  const { auth, env, logger, upgradeWebSocket } = params
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
      upgradeWebSocket(() => {
        ensureSubscriber()
        return {
          onOpen: (_event, ws) => {
            sockets.add(ws)
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

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
