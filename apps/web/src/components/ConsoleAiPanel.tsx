import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"

import { CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { TextureButton } from "@workspace/ui/components/texture-button"

import { Icon } from "@/components/Icon"
import type { ConsoleLine } from "@/hooks/useConsole.types"
import { apiFetch } from "@/lib/ApiFetch"

type Message = {
  id: number
  role: "user" | "assistant"
  text: string
}

const SUGGESTED = [
  "Why is my server crashing?",
  "What does this error mean?",
  "Is there anything unusual in these logs?",
  "How do I improve server performance?",
  "What caused the last restart?",
]

export const ConsoleAiPanel = ({
  serverId,
  lines,
  onClose,
  autoFocus = true,
}: {
  serverId: string
  lines: ConsoleLine[]
  onClose?: () => void
  autoFocus?: boolean
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100)
  }, [autoFocus])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages, loading])

  const sendQuestion = async (question: string) => {
    if (question.trim() === "" || loading) return
    setError(null)
    const userMsg: Message = { id: ++seq.current, role: "user", text: question }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    const logLines = lines
      .slice(-100)
      .map((l) => (l.logTimestamp ? `[${l.logTimestamp}] ${l.line}` : l.line))

    try {
      const data = await apiFetch<{ reply: string }>(
        `/servers/${serverId}/console/ai`,
        {
          method: "POST",
          body: JSON.stringify({ question, logs: logLines }),
        }
      )
      setMessages((prev) => [
        ...prev,
        { id: ++seq.current, role: "assistant", text: data.reply },
      ])
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendQuestion(input)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card p-1 pt-2">
      {/* Header — matches Console card-style header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-2 pb-1">
        <div className="flex items-center gap-1.5">
          <Icon name="ai" size={14} className="text-primary" />
          <CardTitle>AI Assistant</CardTitle>
        </div>
        {onClose !== undefined ? (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <Icon name="cancel" size={14} />
          </button>
        ) : null}
      </div>

      {/* Inner container — themed surface, terminal-dark in dark mode */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/40 shadow-sm dark:bg-[#0e0e0e] dark:shadow-lg dark:shadow-black/20">
        {/* Messages / empty state */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon name="ai" size={18} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  What would you like to know?
                </p>
                <p className="text-xs text-muted-foreground">
                  The last 100 console lines are sent as context.
                </p>
              </div>
              <div className="flex w-full flex-col gap-1.5">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendQuestion(q)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted dark:bg-zinc-900/40 dark:hover:bg-zinc-900/80"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-3 py-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={[
                    "flex flex-col gap-1",
                    msg.role === "user" ? "items-end" : "items-start",
                  ].join(" ")}
                >
                  <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                    {msg.role === "user" ? "You" : "AI"}
                  </span>
                  <div
                    className={[
                      "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground dark:bg-zinc-900/60",
                    ].join(" ")}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex items-start">
                  <div className="rounded-lg border border-border bg-background px-3 py-2 dark:bg-zinc-900/60">
                    <div className="flex gap-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              ) : null}
              {error !== null ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area — mirrors Console's input + send button */}
        <form onSubmit={handleSubmit} className="h-fit border-t border-border p-2">
          {!isEmpty ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {SUGGESTED.slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendQuestion(q)}
                  className="rounded border border-border bg-background px-2 py-0.5 text-[0.6rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:bg-zinc-900/40 dark:hover:bg-zinc-900/80"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-1">
            <div className="w-full">
              <Input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your server…"
                disabled={loading}
              />
            </div>
            <TextureButton
              type="submit"
              disabled={loading || !input.trim()}
              variant="dark"
              size="sm"
              aria-label="Send question"
              className="h-7 w-7 shrink-0 [&>div]:h-full [&>div]:w-full [&>div]:px-0 [&>div]:py-0"
            >
              <Send className="h-3.5 w-3.5" />
            </TextureButton>
          </div>
        </form>
      </div>
    </div>
  )
}
