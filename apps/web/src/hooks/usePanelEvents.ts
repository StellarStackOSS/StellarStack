import { useEffect, useRef, useState } from "react"

import { panelEventSchema } from "@workspace/shared/events"
import type { PanelEvent } from "@workspace/shared/events.types"

import { env } from "@/lib/Env"
import type {
  PanelEventConnectionState,
  UsePanelEventsResult,
} from "@/hooks/usePanelEvents.types"

const MAX_BUFFERED = 50
const BACKOFF_INITIAL_MS = 1_000
const BACKOFF_MAX_MS = 15_000

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Subscribe to the API's `/events` panel-event WebSocket. Returns the
 * current connection state plus the most-recent events (capped at
 * `MAX_BUFFERED`). Reconnects with exponential backoff on transient
 * failures; keeps the most recent buffer across reconnects.
 *
 * The WS is opened only when `enabled` is true, so the dashboard can defer
 * connecting until the session is loaded.
 */
export const usePanelEvents = (
  enabled: boolean
): UsePanelEventsResult => {
  const [state, setState] = useState<PanelEventConnectionState>("closed")
  const [events, setEvents] = useState<PanelEvent[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const backoffRef = useRef(BACKOFF_INITIAL_MS)
  const aliveRef = useRef(true)

  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    aliveRef.current = true

    const connect = () => {
      if (!aliveRef.current) {
        return
      }
      const socket = new WebSocket(`${env.wsUrl}/events`)
      socketRef.current = socket

      socket.addEventListener("open", () => {
        backoffRef.current = BACKOFF_INITIAL_MS
        setState("open")
      })

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return
        }
        const parsed = panelEventSchema.safeParse(safeParse(event.data))
        if (!parsed.success) {
          return
        }
        setEvents((prev) => [...prev, parsed.data].slice(-MAX_BUFFERED))
      })

      const scheduleReconnect = () => {
        if (!aliveRef.current) {
          return
        }
        setState("reconnecting")
        const delay = backoffRef.current
        backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS)
        reconnectRef.current = window.setTimeout(connect, delay)
      }

      socket.addEventListener("close", scheduleReconnect)
      socket.addEventListener("error", () => socket.close())
    }

    queueMicrotask(() => {
      if (!aliveRef.current) {
        return
      }
      setState("connecting")
      connect()
    })

    return () => {
      aliveRef.current = false
      if (reconnectRef.current !== null) {
        window.clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [enabled])

  return { state, events }
}
