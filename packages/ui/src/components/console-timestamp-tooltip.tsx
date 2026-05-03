import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@workspace/ui/lib/utils"

export type TooltipPosition = { top: number; left: number }

type Props = { timestamp: number; position: TooltipPosition; logTimestamp?: string }

const formatLocalTime = (timestamp: number, timezone: string): string => {
  return new Date(timestamp).toLocaleString("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: true,
  })
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mo = Math.floor(d / 30)
  const y = Math.floor(mo / 12)
  if (y > 0) return `${y} year${y > 1 ? "s" : ""} ago`
  if (mo > 0) return `${mo} month${mo > 1 ? "s" : ""} ago`
  if (d > 0) return `${d} day${d > 1 ? "s" : ""} ago`
  if (h > 0) return `${h} hour${h > 1 ? "s" : ""} ago`
  if (m > 0) return `${m} minute${m > 1 ? "s" : ""} ago`
  if (s > 0) return `${s} second${s > 1 ? "s" : ""} ago`
  return "just now"
}

/**
 * Reconstruct a full UTC timestamp from a log's HH:MM:SS[.ms] string. Docker
 * containers run in UTC by default, so the log time is UTC. We take the UTC
 * date portion from `receivedAt` and graft the log's HH:MM:SS onto it. This
 * means the tooltip rows will correctly show "14:12:22 UTC" when the log
 * prints "[14:12:22 INFO]", matching the column value exactly.
 */
const logTimestampToMs = (logTs: string, receivedAt: number): number => {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(logTs)
  if (m === null) return receivedAt
  const h = parseInt(m[1] ?? "0", 10)
  const min = parseInt(m[2] ?? "0", 10)
  const sec = parseInt(m[3] ?? "0", 10)
  const msStr = m[4] ?? "0"
  const ms = parseInt(msStr.padEnd(3, "0").slice(0, 3), 10)
  const base = new Date(receivedAt)
  base.setUTCHours(h, min, sec, ms)
  return base.getTime()
}

export const ConsoleTimestampTooltip = ({ timestamp, position, logTimestamp }: Props) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const formats = useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const ts = logTimestamp !== undefined ? logTimestampToMs(logTimestamp, timestamp) : timestamp
    return {
      local: formatLocalTime(ts, tz),
      tz,
      utc: formatLocalTime(ts, "UTC"),
      relative: formatRelativeTime(ts),
      unix: ts,
    }
  }, [timestamp, logTimestamp])

  if (typeof window === "undefined") return null

  return createPortal(
    <div
      className={cn(
        "animate-in fade-in-0 zoom-in-95 pointer-events-none fixed z-50 min-w-[280px] rounded-lg border p-3 shadow-2xl shadow-black/50 backdrop-blur-md duration-100",
        "border-zinc-200/10 bg-[#0f0f0f]/80"
      )}
      style={{ top: position.top, left: position.left }}
    >
      <div className="space-y-2 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{formats.tz}</span>
          <span className="font-mono text-zinc-200">{formats.local}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">UTC</span>
          <span className="font-mono text-zinc-200">{formats.utc}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Relative</span>
          <span className="text-zinc-200">{formats.relative}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Timestamp</span>
          <span className="font-mono text-zinc-200">{formats.unix}</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
