import { useEffect, useRef, useState } from "react"

import type { ConsoleTerminalProps } from "@/components/ConsoleTerminal.types"

const stateLabel: Record<ConsoleTerminalProps["state"], string> = {
  idle: "idle",
  connecting: "connecting…",
  open: "live",
  reconnecting: "reconnecting…",
  closed: "disconnected",
}

const stateDot: Record<ConsoleTerminalProps["state"], string> = {
  idle: "bg-muted-foreground",
  connecting: "bg-chart-2",
  open: "bg-chart-1",
  reconnecting: "bg-destructive",
  closed: "bg-muted-foreground",
}

/**
 * Live console terminal. Lines stream in from the parent's `useConsole`
 * hook; when `canWrite` is true a single-line input box pushes commands
 * back to the daemon. Auto-scrolls to the bottom on each new line unless
 * the operator has scrolled up (basic detection by reading scrollTop).
 */
export const ConsoleTerminal = ({
  state,
  lines,
  onSend,
  canWrite = true,
}: ConsoleTerminalProps) => {
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    const node = scrollRef.current
    if (node === null) {
      return
    }
    if (!stickToBottomRef.current) {
      return
    }
    node.scrollTop = node.scrollHeight
  }, [lines])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    stickToBottomRef.current = distanceFromBottom < 32
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.trim().length === 0) {
      return
    }
    onSend(draft)
    setDraft("")
    stickToBottomRef.current = true
  }

  return (
    <section className="border-border bg-card text-card-foreground flex flex-col gap-2 rounded-md border p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Console</h2>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className={`size-1.5 rounded-full ${stateDot[state]}`} />
          {stateLabel[state]}
        </span>
      </header>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-background border-border h-72 overflow-y-auto rounded border p-3 font-mono text-xs"
      >
        {lines.length === 0 ? (
          <p className="text-muted-foreground">No output yet.</p>
        ) : (
          lines.map((entry) => (
            <div
              key={entry.id}
              className={
                entry.stream === "stderr"
                  ? "text-destructive whitespace-pre-wrap"
                  : "whitespace-pre-wrap"
              }
            >
              {entry.line}
            </div>
          ))
        )}
      </div>
      {canWrite ? (
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <span className="text-muted-foreground self-center font-mono text-xs">
            $
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a command and press enter"
            className="border-border bg-background h-8 flex-1 rounded-md border px-2 font-mono text-xs"
            disabled={state !== "open"}
          />
        </form>
      ) : null}
    </section>
  )
}
