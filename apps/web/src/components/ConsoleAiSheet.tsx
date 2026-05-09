import { Sheet, SheetContent } from "@workspace/ui/components/sheet"

import { ConsoleAiPanel } from "@/components/ConsoleAiPanel"
import type { ConsoleLine } from "@/hooks/useConsole.types"

export const ConsoleAiSheet = ({
  open,
  onOpenChange,
  serverId,
  lines,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  serverId: string
  lines: ConsoleLine[]
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className="flex w-full flex-col border-0 bg-transparent p-2 shadow-none sm:max-w-md"
      showCloseButton={false}
    >
      <ConsoleAiPanel
        serverId={serverId}
        lines={lines}
        onClose={() => onOpenChange(false)}
        autoFocus={open}
      />
    </SheetContent>
  </Sheet>
)
