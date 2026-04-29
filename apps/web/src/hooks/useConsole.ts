import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  ConsoleConnectionState,
  ConsoleLine,
  UseConsoleResult,
} from "@/hooks/useConsole.types"

const MAX_LINES = 500
const REFRESH_BEFORE_EXPIRY_MS = 15_000

const credentialsSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  wsUrl: z.string(),
})

const inboundFrameSchema = z.object({
  type: z.literal("console.line"),
  stream: z.enum(["stdout", "stderr"]),
  line: z.string(),
})

/**
 * Connect to a server's daemon console WebSocket directly (bypassing the
 * API on the data path). Mints a short-lived JWT via
 * `POST /servers/:id/ws-credentials`, opens `wsUrl` with `?token=…`,
 * appends inbound `console.line` frames to the buffer, refreshes the
 * token shortly before expiry so long-lived connections don't drop.
 *
 * `send(command)` posts a `console.command` frame; the server only honors
 * the write path when the JWT carries `console.write` scope.
 */
export const useConsole = (
  serverId: string,
  enabled: boolean
): UseConsoleResult => {
  const [state, setState] = useState<ConsoleConnectionState>("idle")
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const counterRef = useRef(0)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const aliveRef = useRef(true)

  const connect = useCallback(async () => {
    if (!aliveRef.current) {
      return
    }
    try {
      const text = await apiFetch<unknown>(
        `/servers/${serverId}/ws-credentials`,
        { method: "POST", body: JSON.stringify({}) }
      )
      const parsed = credentialsSchema.safeParse(text)
      if (!parsed.success) {
        throw new Error("Invalid credentials response")
      }
      const url = new URL(parsed.data.wsUrl)
      url.searchParams.set("token", parsed.data.token)
      const ws = new WebSocket(url.toString())
      socketRef.current = ws

      ws.addEventListener("open", () => {
        if (!aliveRef.current) {
          ws.close()
          return
        }
        setState("open")
        const expiresAt = new Date(parsed.data.expiresAt).getTime()
        const refreshIn = Math.max(
          1_000,
          expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS
        )
        refreshTimerRef.current = window.setTimeout(() => {
          ws.close()
        }, refreshIn)
      })

      ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return
        }
        let payload: ReturnType<typeof inboundFrameSchema.safeParse>
        try {
          payload = inboundFrameSchema.safeParse(JSON.parse(event.data))
        } catch {
          return
        }
        if (!payload.success) {
          return
        }
        counterRef.current += 1
        setLines((prev) =>
          [
            ...prev,
            {
              id: counterRef.current,
              stream: payload.data.stream,
              line: payload.data.line,
            },
          ].slice(-MAX_LINES)
        )
      })

      ws.addEventListener("close", () => {
        if (refreshTimerRef.current !== null) {
          window.clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = null
        }
        if (!aliveRef.current) {
          return
        }
        setState("reconnecting")
        reconnectTimerRef.current = window.setTimeout(() => {
          void connect()
        }, 1_000)
      })

      ws.addEventListener("error", () => {
        ws.close()
      })
    } catch {
      if (!aliveRef.current) {
        return
      }
      setState("reconnecting")
      reconnectTimerRef.current = window.setTimeout(() => {
        void connect()
      }, 2_000)
    }
  }, [serverId])

  useEffect(() => {
    aliveRef.current = true
    if (!enabled) {
      return undefined
    }
    queueMicrotask(() => {
      if (!aliveRef.current) {
        return
      }
      setState("connecting")
      void connect()
    })
    return () => {
      aliveRef.current = false
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [connect, enabled])

  const send = useCallback((command: string) => {
    const ws = socketRef.current
    if (ws === null || ws.readyState !== 1) {
      return
    }
    ws.send(JSON.stringify({ type: "console.command", command }))
  }, [])

  return { state, lines, send }
}
