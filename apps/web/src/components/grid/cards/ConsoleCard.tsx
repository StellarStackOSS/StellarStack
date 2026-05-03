import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { ConsoleLine, ConsoleConnectionState } from "@/hooks/useConsole.types"

const LOG_COLORS: Record<string, string> = {
  ERROR: "#f87171",
  WARN:  "#fbbf24",
  INFO:  "#60a5fa",
  DEBUG: "#a3a3a3",
}

const detectLevel = (line: string): string => {
  const upper = line.toUpperCase()
  for (const level of Object.keys(LOG_COLORS)) {
    if (upper.includes(`[${level}]`) || upper.includes(` ${level} `)) {
      return level
    }
  }
  return ""
}

const formatTs = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}

export const ConsoleCard = ({
  lines,
  onSend,
  state,
}: {
  lines: ConsoleLine[]
  onSend: (cmd: string) => void
  state: ConsoleConnectionState
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState("")
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(true)
  const isConnected = state === "open"

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ block: "end" })
    }
  }, [lines, autoScroll])

  const handleScroll = () => {
    const el = containerRef.current
    if (el === null) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32
    setAutoScroll(atBottom)
  }

  const handleSend = () => {
    const cmd = input.trim()
    if (cmd === "") return
    onSend(cmd)
    setCmdHistory((prev) => [cmd, ...prev].slice(0, 50))
    setHistIdx(-1)
    setInput("")
    setAutoScroll(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend()
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHistIdx((i) => {
        const next = Math.min(i + 1, cmdHistory.length - 1)
        setInput(cmdHistory[next] ?? "")
        return next
      })
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHistIdx((i) => {
        const next = Math.max(i - 1, -1)
        setInput(next === -1 ? "" : (cmdHistory[next] ?? ""))
        return next
      })
    }
  }

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-white/[0.07] bg-[#0d0d0d] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
      onClick={() => inputRef.current?.focus()}
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
        <span className="text-[0.65rem] font-medium uppercase tracking-widest text-zinc-500">
          Console
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={[
              "size-1.5 rounded-full",
              isConnected ? "bg-emerald-500" : "bg-red-500 animate-pulse",
            ].join(" ")}
          />
          <span className="text-[0.6rem] text-zinc-600">
            {isConnected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>

      {/* log area */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[0.7rem] leading-relaxed"
        onScroll={handleScroll}
      >
        {lines.map((line, idx) => {
          const level = detectLevel(line.text)
          const color = LOG_COLORS[level] ?? (line.historical ? "#52525b" : "#d4d4d8")
          return (
            <div key={idx} className="flex gap-3 hover:bg-white/[0.02] px-1 rounded">
              <span className="shrink-0 select-none text-zinc-700">
                {formatTs(line.receivedAt)}
              </span>
              <span style={{ color }}>{line.text}</span>
            </div>
          )
        })}
        {lines.length === 0 ? (
          <p className="text-zinc-700 italic">No output yet…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* scroll-to-bottom hint */}
      {!autoScroll ? (
        <button
          type="button"
          className="mx-4 mb-1 rounded bg-white/5 px-2 py-0.5 text-center text-[0.65rem] text-zinc-500 hover:bg-white/10"
          onClick={() => {
            setAutoScroll(true)
            bottomRef.current?.scrollIntoView({ block: "end" })
          }}
        >
          ↓ scroll to bottom
        </button>
      ) : null}

      {/* input */}
      <div className="flex items-center gap-2 border-t border-white/[0.05] px-3 py-2">
        <span className="text-zinc-700 select-none font-mono text-xs">›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? "Enter command…" : "Not connected"}
          disabled={!isConnected}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!isConnected || input.trim() === ""}
          onClick={handleSend}
          className="shrink-0 text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </button>
      </div>
    </div>
  )
}
