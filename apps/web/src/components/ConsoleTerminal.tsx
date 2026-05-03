import { Console } from "@workspace/ui/components/console"
import type { RichConsoleLine } from "@workspace/ui/components/console"

import type { ConsoleTerminalProps } from "@/components/ConsoleTerminal.types"

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
}: ConsoleTerminalProps) => {
  const isOffline = state !== "open"

  return (
    <Console
      lines={lines.map(toRichLine)}
      onCommand={canWrite ? onSend : undefined}
      isOffline={isOffline}
      showSendButton={canWrite}
      wrapperClassName="flex-1 min-h-0"
    />
  )
}
