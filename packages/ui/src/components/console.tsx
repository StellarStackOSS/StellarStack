import { useCallback, useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import { TextureButton } from "@workspace/ui/components/texture-button"
import { ConsoleScrollContext } from "@workspace/ui/components/console-scroll-context"
import { ConsoleTimestampTooltip } from "@workspace/ui/components/console-timestamp-tooltip"
import type { TooltipPosition } from "@workspace/ui/components/console-timestamp-tooltip"

export type ConsoleLineLevel = "default" | "info" | "warn" | "error"

export type RichConsoleLine = {
  id: number
  timestamp: number
  /** Pre-extracted time string from the log line itself (e.g. "13:37:00"). */
  displayTimestamp?: string
  level: ConsoleLineLevel
  message: string
}

export type ConsoleProps = {
  lines?: RichConsoleLine[]
  onCommand?: (command: string) => void
  maxLines?: number
  /** Applied to the outermost wrapper so parents can pass flex-1 etc. */
  wrapperClassName?: string
  className?: string
  isOffline?: boolean
  showSendButton?: boolean
}

const formatTimestamp = (timestamp: number): string => {
  const d = new Date(timestamp)
  const h = d.getHours().toString().padStart(2, "0")
  const m = d.getMinutes().toString().padStart(2, "0")
  const s = d.getSeconds().toString().padStart(2, "0")
  const ms = d.getMilliseconds().toString().padStart(3, "0")
  return `${h}:${m}:${s}.${ms}`
}

const rowClass = (level: ConsoleLineLevel): string => {
  if (level === "warn" || level === "error") return "bg-red-500/10 hover:bg-red-500/15"
  return "hover:bg-zinc-900/50"
}

// formatClock renders an epoch-ms timestamp as `HH:MM:SS` in the
// browser's locale. Used as the fallback for lines that don't have an
// embedded `[HH:MM:SS]` (synthetic daemon-status lines, our own
// "Server marked as offline" headers, etc) so the timestamp column is
// never blank — the line still has its receivedAt to fall back on.
const formatClock = (epochMs: number): string => {
  const d = new Date(epochMs)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const textClass = (level: ConsoleLineLevel): string => {
  if (level === "warn" || level === "error") return "text-red-300"
  return "text-zinc-300"
}

const parseLinks = (text: string): React.ReactNode => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline transition-opacity hover:opacity-80"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

export const Console = ({
  lines = [],
  onCommand,
  maxLines = 250,
  wrapperClassName,
  className,
  isOffline = false,
  showSendButton = false,
}: ConsoleProps) => {
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(true)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [scrollSignal, setScrollSignal] = useState(0)
  const [hoveredTs, setHoveredTs] = useState<number | null>(null)
  const [hoveredLogTs, setHoveredLogTs] = useState<string | undefined>(undefined)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Smooth scroll fires handleScroll mid-animation, briefly registers
  // a not-at-bottom position, and flips autoScroll false — so the next
  // line append doesn't auto-scroll. Instant scroll skips that race.
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "instant" as ScrollBehavior })
    }
  }, [lines, autoScroll])

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      setCanScrollUp(scrollHeight > clientHeight && scrollTop > 10)
    }
  }, [lines])

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
      setCanScrollUp(scrollTop > 10)
      setHoveredTs(null)
      setHoveredLogTs(undefined)
      setScrollSignal((n) => n + 1)
    }
  }, [])

  const handleTsEnter = useCallback((ts: number, logTs: string | undefined, e: React.MouseEvent) => {
    setHoveredTs(ts)
    setHoveredLogTs(logTs)
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltipPos({ top: rect.top, left: rect.right + 12 })
  }, [])

  const handleTsMove = useCallback((ts: number, logTs: string | undefined, e: React.MouseEvent) => {
    setHoveredTs(ts)
    setHoveredLogTs(logTs)
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltipPos({ top: rect.top, left: rect.right + 12 })
  }, [])

  const handleTsLeave = useCallback(() => {
    setHoveredTs(null)
    setHoveredLogTs(undefined)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isOffline || !input.trim() || !onCommand) return
    onCommand(input.trim())
    setHistory((prev) => [...prev, input.trim()])
    setHistoryIdx(-1)
    setInput("")
    setAutoScroll(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length > 0) {
        const idx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1)
        setHistoryIdx(idx)
        setInput(history[idx] ?? "")
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIdx !== -1) {
        const idx = historyIdx + 1
        if (idx >= history.length) {
          setHistoryIdx(-1)
          setInput("")
        } else {
          setHistoryIdx(idx)
          setInput(history[idx] ?? "")
        }
      }
    }
  }

  const handleConsoleClick = (e: React.MouseEvent) => {
    const sel = window.getSelection()
    if (sel && sel.toString().length > 0) return
    if ((e.target as HTMLElement).tagName === "A") return
    inputRef.current?.focus()
  }

  const display = lines.slice(-maxLines)

  return (
    <div className={cn("flex flex-col rounded-lg border border-white/5 bg-card p-1 pt-2", wrapperClassName)}>
      <div className="shrink-0 pb-1 pl-2 text-xs opacity-50">CONSOLE</div>

      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col rounded-lg border transition-colors",
          "border-zinc-200/10 bg-[#0e0e0e] shadow-lg shadow-black/20",
          isOffline && "opacity-60",
          className
        )}
        onClick={handleConsoleClick}
      >
        <div className="flex items-center justify-end border-b border-zinc-200/10 px-4 py-2">
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true)
                  scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
                }}
                className="cursor-pointer text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Scroll to bottom
              </button>
            )}
            <span className="text-xs text-zinc-600">{display.length} lines</span>
          </div>
        </div>

        <ConsoleScrollContext.Provider value={scrollSignal}>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {isOffline && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  Server is offline
                </span>
              </div>
            )}
            <div
              className={cn(
                "pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 transition-opacity duration-300",
                "bg-gradient-to-b from-[#0f0f0f] to-transparent",
                autoScroll && canScrollUp ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              onMouseLeave={handleTsLeave}
              className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700 flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-2 font-mono text-xs"
            >
              <div className="flex flex-col">
                {display.map((line) => (
                  <div key={line.id} className={cn("group flex gap-3 rounded-sm px-1", rowClass(line.level))}>
                    <span
                      className="w-[90px] shrink-0 cursor-default whitespace-nowrap py-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                      onMouseEnter={(e) => handleTsEnter(line.timestamp, line.displayTimestamp, e)}
                      onMouseMove={(e) => handleTsMove(line.timestamp, line.displayTimestamp, e)}
                      onMouseLeave={handleTsLeave}
                    >
                      {line.displayTimestamp ?? formatClock(line.timestamp)}
                    </span>
                    <span className={cn("min-w-0 break-words py-0.5 select-text", textClass(line.level))}>
                      {parseLinks(line.message)}
                    </span>
                  </div>
                ))}
              </div>

              {hoveredTs !== null && tooltipPos !== null && (
                <ConsoleTimestampTooltip timestamp={hoveredTs} position={tooltipPos} logTimestamp={hoveredLogTs} />
              )}
            </div>
          </div>
        </ConsoleScrollContext.Provider>

        <form onSubmit={handleSubmit} className="h-fit border-t border-zinc-200/10 p-2">
          <div className="flex items-center gap-1">
            <div className="w-full">
              <Input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isOffline ? "Connection lost..." : "Enter command..."}
                disabled={isOffline}
                className={cn(isOffline && "cursor-not-allowed")}
              />
            </div>
            {showSendButton && (
              <TextureButton
                type="submit"
                disabled={isOffline || !input.trim()}
                variant="dark"
                size="sm"
                aria-label="Send command"
                className="h-7 w-7 shrink-0 [&>div]:h-full [&>div]:w-full [&>div]:px-0 [&>div]:py-0"
              >
                <Send className="h-3.5 w-3.5" />
              </TextureButton>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
