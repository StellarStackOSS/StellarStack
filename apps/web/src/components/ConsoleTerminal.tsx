import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MetalFx } from "metal-fx"

import { Console } from "@workspace/ui/components/console"
import type { RichConsoleLine } from "@workspace/ui/components/console"

import { ConsoleAiPanel } from "@/components/ConsoleAiPanel"
import { ConsoleAiSheet } from "@/components/ConsoleAiSheet"
import type { ConsoleTerminalProps } from "@/components/ConsoleTerminal.types"
import { useTheme } from "@/components/ThemeProvider"

const toRichLine = (line: ConsoleTerminalProps["lines"][number]): RichConsoleLine => ({
  id: line.id,
  timestamp: line.receivedAt,
  displayTimestamp: line.logTimestamp ?? undefined,
  level: line.logLevel,
  message: line.line,
})

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 768px)").matches
  )
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(mql.matches)
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])
  return isDesktop
}

export const ConsoleTerminal = ({
  state,
  lines,
  onSend,
  canWrite = true,
  serverId,
}: ConsoleTerminalProps) => {
  const isOffline = state !== "open"
  const [aiOpen, setAiOpen] = useState(false)
  const isDesktop = useIsDesktop()
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
        onClick={() => setAiOpen((v) => !v)}
        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-medium ${
          resolvedTheme === "light" ? "text-zinc-900" : "text-white"
        }`}
      >
        Ask AI
      </button>
    </MetalFx>
  ) : undefined

  const showInline = isDesktop && aiOpen && serverId !== undefined
  const showSheet = !isDesktop && aiOpen && serverId !== undefined

  return (
    <div className="flex min-h-0 flex-1 flex-row gap-3">
      <Console
        lines={lines.map(toRichLine)}
        onCommand={canWrite ? onSend : undefined}
        isOffline={isOffline}
        showSendButton={canWrite}
        wrapperClassName="flex-1 min-h-0 min-w-0"
        headerActions={aiButton}
      />

      <AnimatePresence initial={false}>
        {showInline && (
          <motion.div
            key="ai-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <div className="h-full w-[380px]">
              <ConsoleAiPanel
                serverId={serverId!}
                lines={lines}
                onClose={() => setAiOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {serverId !== undefined && (
        <ConsoleAiSheet
          open={showSheet}
          onOpenChange={setAiOpen}
          serverId={serverId}
          lines={lines}
        />
      )}
    </div>
  )
}
