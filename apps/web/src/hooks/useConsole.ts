import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  ConsoleConnectionState,
  ConsoleLine,
  ConsoleLogLevel,
  UseConsoleResult,
} from "@/hooks/useConsole.types"

// Matches leading container-embedded timestamps like [HH:MM:SS], [HH:MM:SS INFO], or [YYYY-MM-DDTHH:MM:SSZ].
const CONTAINER_TS_RE =
  /^(\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]\s*|\[\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:\s+\w+)?\]\s*)+/

const LEVEL_RE = /\b(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/i

const inferLevel = (inner: string): ConsoleLogLevel => {
  const m = LEVEL_RE.exec(inner)
  if (m === null) return "default"
  const word = m[1]!.toUpperCase()
  if (word === "INFO") return "info"
  if (word === "DEBUG") return "default"
  if (word === "WARN" || word === "WARNING") return "warn"
  return "error"
}

const parseLogLine = (raw: string): { text: string; logTimestamp: string | null; logLevel: ConsoleLogLevel } => {
  const m = CONTAINER_TS_RE.exec(raw)
  if (m === null) return { text: raw, logTimestamp: null, logLevel: "default" }
  const inner = m[0].replace(/^\[/, "").split("]")[0] ?? ""
  const timeMatch = /(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(inner)
  const stripped = raw.slice(m[0].length).replace(/^:\s*/, "")
  return {
    text: stripped,
    logTimestamp: timeMatch ? timeMatch[1] : null,
    logLevel: inferLevel(inner),
  }
}

const MAX_LINES = 250
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
  historical: z.boolean().optional(),
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
 *
 * Uses AbortController to cancel in-flight credential fetches and WS
 * setup when the effect is torn down, preventing the React Strict Mode
 * double-invoke from producing two simultaneous connections.
 */
export const useConsole = (
  serverId: string,
  enabled: boolean
): UseConsoleResult => {
  const [state, setState] = useState<ConsoleConnectionState>("idle")
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const counterRef = useRef(0)
  const hasConnectedRef = useRef(false)
  const skipHistoricalRef = useRef(false)
  const plannedRefreshRef = useRef(false)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const refreshTimerRef = useRef<number | null>(null)

  const connect = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) return
      skipHistoricalRef.current = hasConnectedRef.current
      try {
        const text = await apiFetch<unknown>(
          `/servers/${serverId}/ws-credentials`,
          { method: "POST", body: JSON.stringify({}) }
        )
        if (signal.aborted) return
        const parsed = credentialsSchema.safeParse(text)
        if (!parsed.success) throw new Error("Invalid credentials response")

        const url = new URL(parsed.data.wsUrl)
        url.searchParams.set("token", parsed.data.token)
        const ws = new WebSocket(url.toString())
        socketRef.current = ws

        signal.addEventListener("abort", () => {
          ws.close()
        })

        ws.addEventListener("open", () => {
          if (signal.aborted) {
            ws.close()
            return
          }
          hasConnectedRef.current = true
          setState("open")
          const expiresAt = new Date(parsed.data.expiresAt).getTime()
          const refreshIn = Math.max(
            1_000,
            expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS
          )
          refreshTimerRef.current = window.setTimeout(() => {
            plannedRefreshRef.current = true
            ws.close()
          }, refreshIn)
        })

        ws.addEventListener("message", (event) => {
          if (typeof event.data !== "string") return
          let payload: ReturnType<typeof inboundFrameSchema.safeParse>
          try {
            payload = inboundFrameSchema.safeParse(JSON.parse(event.data))
          } catch {
            return
          }
          if (!payload.success) return
          if (payload.data.historical && skipHistoricalRef.current) return
          counterRef.current += 1
          const { text, logTimestamp, logLevel } = parseLogLine(payload.data.line)
          setLines((prev) =>
            [
              ...prev,
              {
                id: counterRef.current,
                stream: payload.data.stream,
                line: text,
                logTimestamp,
                logLevel: payload.data.stream === "stderr" && logLevel === "default" ? "error" : logLevel,
                historical: payload.data.historical ?? false,
                receivedAt: Date.now(),
              },
            ].slice(-MAX_LINES)
          )
        })

        ws.addEventListener("close", () => {
          if (refreshTimerRef.current !== null) {
            window.clearTimeout(refreshTimerRef.current)
            refreshTimerRef.current = null
          }
          if (signal.aborted) return
          const isRefresh = plannedRefreshRef.current
          plannedRefreshRef.current = false
          if (!isRefresh) {
            setLines([])
            hasConnectedRef.current = false
            skipHistoricalRef.current = false
          }
          setState("reconnecting")
          reconnectTimerRef.current = window.setTimeout(() => {
            void connect(signal)
          }, 1_000)
        })

        ws.addEventListener("error", () => {
          ws.close()
        })
      } catch {
        if (signal.aborted) return
        setState("reconnecting")
        reconnectTimerRef.current = window.setTimeout(() => {
          void connect(signal)
        }, 2_000)
      }
    },
    [serverId]
  )

  useEffect(() => {
    if (!enabled) {
      setLines([])
      setState("idle")
      return
    }
    const ac = new AbortController()
    setState("connecting")
    void connect(ac.signal)
    return () => {
      ac.abort()
      hasConnectedRef.current = false
      skipHistoricalRef.current = false
      setLines([])
      setState("idle")
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
    if (ws === null || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: "console.command", command }))
  }, [])

  return { state, lines, send }
}
