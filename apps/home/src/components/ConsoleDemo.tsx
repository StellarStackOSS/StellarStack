import { useEffect, useRef, useState } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

const SCRIPT: string[] = [
  "[StellarStack Daemon]: Updating process configuration files...",
  "[StellarStack Daemon]: Pulling Docker container image...",
  "[StellarStack Daemon]: Finished pulling Docker container image",
  "stellarstack@9457566a~ Server marked as starting...",
  "[14:12:05] [Server thread/INFO]: Starting minecraft server version 1.21.4",
  "[14:12:05] [Server thread/INFO]: Loading properties",
  "[14:12:06] [Server thread/INFO]: Generating keypair",
  "[14:12:06] [Server thread/INFO]: Starting Minecraft server on *:25565",
  "[14:12:07] [Server thread/INFO]: Preparing level \"world\"",
  "[14:12:09] [Worker-Main-2/INFO]: Preparing spawn area: 64%",
  "[14:12:11] [Server thread/INFO]: Time elapsed: 4203 ms",
  "[14:12:11] [Server thread/INFO]: Done (4.203s)! For help, type \"help\"",
  "stellarstack@9457566a~ Server marked as running...",
]

const colour = (line: string): string => {
  if (line.startsWith("[StellarStack")) return "text-amber-300/90"
  if (line.startsWith("stellarstack@")) return "text-emerald-400/90"
  return "text-zinc-300"
}

const STEP_MS = 700
const PAUSE_MS = 4_000

export const ConsoleDemo = ({ height = 176 }: { height?: number }) => {
  const [lines, setLines] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Single timeout-driven loop: type a line, schedule next; once the
  // script's exhausted, hold a beat then reset. Avoids double-interval
  // races + StrictMode dev double-mount surprises.
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    let i = 0

    const tick = () => {
      if (cancelled) return
      if (i >= SCRIPT.length) {
        timer = window.setTimeout(() => {
          if (cancelled) return
          i = 0
          setLines([])
          timer = window.setTimeout(tick, STEP_MS)
        }, PAUSE_MS)
        return
      }
      const next = SCRIPT[i]!
      i++
      setLines((prev) => [...prev, next])
      timer = window.setTimeout(tick, STEP_MS)
    }

    timer = window.setTimeout(tick, 400)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  // Auto-scroll to the bottom on every new line so the most recent
  // output is always visible inside the small fixed-height panel.
  useEffect(() => {
    const el = scrollRef.current
    if (el === null) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <Card className="w-full" style={{ height }}>
      <CardHeader>
        <CardTitle
          className="flex items-center justify-between gap-2"
          style={{ fontSize: 11 }}
        >
          <span>Console</span>
          <span className="font-normal text-zinc-600" style={{ fontSize: 10 }}>
            {lines.length} lines
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <CardInner className="relative h-full min-h-0 overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-[#0e0e0e] to-transparent" />
          <div
            ref={scrollRef}
            className="font-mono h-full overflow-auto px-3 py-2"
            style={{ fontSize: 11, lineHeight: "16px" }}
          >
            {lines.map((l, i) => (
              <div
                key={i}
                className={`${colour(l)} whitespace-pre-wrap break-all`}
              >
                {l}
              </div>
            ))}
          </div>
        </CardInner>
      </CardContent>
    </Card>
  )
}
