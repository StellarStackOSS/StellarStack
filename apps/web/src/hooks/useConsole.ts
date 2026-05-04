import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import type { ServerLifecycleState } from "@workspace/shared/events.types"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  ConsoleConnectionState,
  ConsoleLine,
  ConsoleLogLevel,
  ConsolePowerAction,
  UseConsoleResult,
} from "@/hooks/useConsole.types"
import type { StatsSample } from "@/hooks/useServerStats.types"

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

const parseLogLine = (
  raw: string
): { text: string; logTimestamp: string | null; logLevel: ConsoleLogLevel } => {
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
const MAX_STATS = 60
const REFRESH_BEFORE_EXPIRY_MS = 60_000

const credentialsSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  wsUrl: z.string(),
})

const stateSchema = z.enum(["offline", "starting", "running", "stopping"])

const statsPayloadSchema = z.object({
  memory_bytes: z.number().nonnegative(),
  memory_limit_bytes: z.number().nonnegative(),
  cpu_absolute: z.number().nonnegative(),
  network: z.object({
    rx_bytes: z.number().nonnegative(),
    tx_bytes: z.number().nonnegative(),
  }),
  disk_bytes: z.number().nonnegative(),
  disk_read_bytes: z.number().nonnegative(),
  disk_write_bytes: z.number().nonnegative(),
  uptime_ms: z.number().nonnegative().optional(),
  state: stateSchema,
})

const envelopeSchema = z.object({
  event: z.string(),
  args: z.array(z.unknown()).default([]),
})

/**
 * Connect to a server's daemon console WebSocket directly. Mints a
 * short-lived JWT via `POST /servers/:id/credentials`, opens the daemon
 * socket, and multiplexes every signal the UI needs (lifecycle state,
 * console lines, stats samples, power dispatch). One socket per server
 * page; on `token expiring` the hook re-mints inline (no reconnect, no
 * buffer reset).
 */
export const useConsole = (serverId: string, enabled: boolean): UseConsoleResult => {
  const queryClient = useQueryClient()
  const [state, setState] = useState<ConsoleConnectionState>("idle")
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const [status, setStatus] = useState<ServerLifecycleState | null>(null)
  const [statsHistory, setStatsHistory] = useState<StatsSample[]>([])

  // Whenever the daemon WS reports a fresh status, also write it
  // through to the React Query cache for the server detail row so any
  // component reading from `useServer(id)` (the layout fallback when
  // consoleHook.status is null, the dashboard list, etc.) reflects
  // it on the next render. Belt-and-suspenders against missed frames.
  useEffect(() => {
    if (status === null) return
    queryClient.setQueryData<{ server: { status: ServerLifecycleState } }>(
      ["servers", serverId],
      (existing) => {
        if (existing === undefined) return existing
        if (existing.server.status === status) return existing
        return { ...existing, server: { ...existing.server, status } }
      }
    )
  }, [status, serverId, queryClient])
  const counterRef = useRef(0)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const expiresAtRef = useRef<number>(0)

  const send = useCallback((envelope: { event: string; args: unknown[] }) => {
    const ws = socketRef.current
    if (ws === null || ws.readyState !== 1) return
    ws.send(JSON.stringify(envelope))
  }, [])

  const sendCommand = useCallback(
    (line: string) => send({ event: "send command", args: [line] }),
    [send]
  )
  const setStateAction = useCallback(
    (action: ConsolePowerAction) => send({ event: "set state", args: [action] }),
    [send]
  )

  const refreshToken = useCallback(async () => {
    try {
      const text = await apiFetch<unknown>(`/servers/${serverId}/credentials`, {
        method: "POST",
        body: JSON.stringify({ purpose: "console" }),
      })
      const parsed = credentialsSchema.safeParse(text)
      if (!parsed.success) return
      expiresAtRef.current = new Date(parsed.data.expiresAt).getTime()
      send({ event: "auth", args: [parsed.data.token] })
    } catch {
      // Network / API blip; the daemon will eventually emit `token
      // expired` and we'll fall through to a hard reconnect on close.
    }
  }, [send, serverId])

  const connect = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) return
      try {
        const text = await apiFetch<unknown>(`/servers/${serverId}/credentials`, {
          method: "POST",
          body: JSON.stringify({ purpose: "console" }),
        })
        if (signal.aborted) return
        const parsed = credentialsSchema.safeParse(text)
        if (!parsed.success) throw new Error("Invalid credentials response")
        expiresAtRef.current = new Date(parsed.data.expiresAt).getTime()

        const url = new URL(parsed.data.wsUrl)
        url.searchParams.set("token", parsed.data.token)
        const ws = new WebSocket(url.toString())
        socketRef.current = ws

        signal.addEventListener("abort", () => ws.close())

        ws.addEventListener("open", () => {
          if (signal.aborted) {
            ws.close()
            return
          }
          setState("open")
          // Schedule a token refresh well before exp so a slow network
          // can't leave the token stale before we re-auth.
          const remaining = expiresAtRef.current - Date.now()
          const delay = Math.max(5_000, remaining - REFRESH_BEFORE_EXPIRY_MS)
          refreshTimerRef.current = window.setTimeout(() => {
            void refreshToken()
          }, delay)
        })

        ws.addEventListener("message", (event) => {
          if (typeof event.data !== "string") return
          let payload: unknown
          try {
            payload = JSON.parse(event.data)
          } catch {
            return
          }
          const env = envelopeSchema.safeParse(payload)
          if (!env.success) return
          dispatchFrame(env.data.event, env.data.args, {
            setStatus,
            setLines,
            setStatsHistory,
            counterRef,
          })
          if (env.data.event === "token expiring") {
            void refreshToken()
          }
        })

        ws.addEventListener("close", () => {
          if (refreshTimerRef.current !== null) {
            window.clearTimeout(refreshTimerRef.current)
            refreshTimerRef.current = null
          }
          if (signal.aborted) return
          setState("reconnecting")
          reconnectTimerRef.current = window.setTimeout(() => {
            void connect(signal)
          }, 1_500)
        })

        ws.addEventListener("error", () => ws.close())
      } catch {
        if (signal.aborted) return
        setState("reconnecting")
        reconnectTimerRef.current = window.setTimeout(() => {
          void connect(signal)
        }, 2_000)
      }
    },
    [refreshToken, serverId]
  )

  useEffect(() => {
    if (!enabled) {
      setLines([])
      setStatsHistory([])
      setStatus(null)
      setState("idle")
      return
    }
    const ac = new AbortController()
    setState("connecting")
    void connect(ac.signal)
    return () => {
      ac.abort()
      setLines([])
      setStatsHistory([])
      setStatus(null)
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

  const latestStats = statsHistory.length > 0 ? statsHistory[statsHistory.length - 1]! : null

  return {
    state,
    status,
    lines,
    stats: { latest: latestStats, history: statsHistory },
    sendCommand,
    setState: setStateAction,
  }
}

type FrameSetters = {
  setStatus: (s: ServerLifecycleState) => void
  setLines: React.Dispatch<React.SetStateAction<ConsoleLine[]>>
  setStatsHistory: React.Dispatch<React.SetStateAction<StatsSample[]>>
  counterRef: React.MutableRefObject<number>
}

const dispatchFrame = (
  event: string,
  args: unknown[],
  setters: FrameSetters
) => {
  switch (event) {
    case "status": {
      const v = stateSchema.safeParse(args[0])
      if (v.success) setters.setStatus(v.data)
      return
    }
    case "console output": {
      const raw = typeof args[0] === "string" ? args[0] : null
      if (raw === null) return
      setters.counterRef.current += 1
      const { text, logTimestamp, logLevel } = parseLogLine(raw)
      const id = setters.counterRef.current
      setters.setLines((prev) =>
        [
          ...prev,
          {
            id,
            stream: "stdout" as const,
            line: text,
            logTimestamp,
            logLevel,
            historical: false,
            receivedAt: Date.now(),
          },
        ].slice(-MAX_LINES)
      )
      return
    }
    case "stats": {
      const v = statsPayloadSchema.safeParse(args[0])
      if (!v.success) return
      const p = v.data
      const sample: StatsSample = {
        receivedAt: Date.now(),
        memoryBytes: p.memory_bytes,
        memoryLimitBytes: p.memory_limit_bytes,
        cpuFraction: p.cpu_absolute / 100,
        diskBytes: p.disk_bytes,
        networkRxBytes: p.network.rx_bytes,
        networkTxBytes: p.network.tx_bytes,
        diskReadBytes: p.disk_read_bytes,
        diskWriteBytes: p.disk_write_bytes,
        startedAt:
          p.uptime_ms !== undefined
            ? new Date(Date.now() - p.uptime_ms).toISOString()
            : undefined,
      }
      setters.setStatsHistory((prev) => [...prev, sample].slice(-MAX_STATS))
      // Status piggybacks on stats so a missed `status` frame is recovered.
      setters.setStatus(p.state)
      return
    }
    case "auth success":
    case "token expired":
    case "daemon error":
    default:
      return
  }
}
