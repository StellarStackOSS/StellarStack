import { MetalFx } from "metal-fx"

import { Console } from "@workspace/ui/components/console"
import type { RichConsoleLine } from "@workspace/ui/components/console"

import type { ConsoleTerminalProps } from "@/components/ConsoleTerminal.types"
import { useServerLayout } from "@/components/ServerLayoutContext"
import { useTheme } from "@/components/ThemeProvider"

const toRichLine = (line: ConsoleTerminalProps["lines"][number]): RichConsoleLine => ({
  id: line.id,
  timestamp: line.receivedAt,
  displayTimestamp: line.logTimestamp ?? undefined,
  level: line.logLevel,
  message: line.line,
})

export const ConsoleTerminal = ({
  state,
  lines,
  onSend,
  canWrite = true,
  serverId,
}: ConsoleTerminalProps) => {
  const isOffline = state !== "open"
  const { aiOpen, setAiOpen } = useServerLayout()
  const { theme } = useTheme()
  const resolvedTheme: "dark" | "light" =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme

  const aiButton = serverId !== undefined ? (
    <MetalFx preset="chromatic" strength={1} variant="button" theme={resolvedTheme}>
      <button
        type="button"
        onClick={() => setAiOpen(!aiOpen)}
        className={`rounded-md px-2.5 py-1 text-[0.65rem] font-medium ${
          resolvedTheme === "light" ? "text-zinc-900" : "text-white"
        }`}
      >
        Ask AI
      </button>
    </MetalFx>
  ) : undefined

  return (
    <Console
      lines={lines.map(toRichLine)}
      onCommand={canWrite ? onSend : undefined}
      isOffline={isOffline}
      showSendButton={canWrite}
      wrapperClassName="flex-1 min-h-0 min-w-0"
      headerActions={aiButton}
    />
  )
}
