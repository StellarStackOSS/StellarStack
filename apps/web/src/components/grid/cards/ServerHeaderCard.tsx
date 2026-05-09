import { Button } from "@workspace/ui/components/button"

import { Icon } from "@/components/Icon"

import type { ServerLifecycleState } from "@workspace/shared/events.types"
import type { ServerListRow } from "@/hooks/useServers.types"

type PowerAction = "start" | "stop" | "restart" | "kill"

const STATUS_DOT: Record<ServerLifecycleState, string> = {
  offline: "bg-zinc-600",
  starting: "bg-emerald-400 animate-pulse",
  running: "bg-emerald-500",
  stopping: "bg-amber-400 animate-pulse",
}

const STATUS_LABEL: Record<ServerLifecycleState, string> = {
  offline: "Offline",
  starting: "Starting",
  running: "Running",
  stopping: "Stopping",
}

export const ServerHeaderCard = ({
  server,
  status,
  isPending,
  onPower,
}: {
  server: ServerListRow
  status: ServerLifecycleState
  isPending: boolean
  onPower: (action: PowerAction) => void
}) => {
  const canStart = status === "offline"
  const canStop = status === "running" || status === "starting"
  const canKill = status === "running" || status === "starting" || status === "stopping"
  const canRestart = status === "running"
  const locked = false

  return (
    <div className="flex h-full items-center justify-between rounded-xl border border-border bg-card px-5 shadow-sm dark:bg-gradient-to-b dark:from-[#1a1a1a] dark:to-[#0d0d0d] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      {/* left: name + status */}
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-foreground truncate text-base font-semibold">
          {server.name}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={[
              "size-1.5 rounded-full",
              STATUS_DOT[status] ?? "bg-muted-foreground/40",
            ].join(" ")}
          />
          <span className="text-muted-foreground text-xs">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      {/* right: power controls */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-foreground border-border bg-muted/40 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 disabled:opacity-30 h-8 gap-1.5 border"
          disabled={isPending || !canStart || locked}
          onClick={() => onPower("start")}
          title="Start"
        >
          <Icon name="play" className="size-3.5" />
          <span className="hidden sm:inline text-xs">Start</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-foreground border-border bg-muted/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 disabled:opacity-30 h-8 gap-1.5 border"
          disabled={isPending || !canRestart || locked}
          onClick={() => onPower("restart")}
          title="Restart"
        >
          <Icon name="refresh" className="size-3.5" />
          <span className="hidden sm:inline text-xs">Restart</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-foreground border-border bg-muted/40 hover:bg-muted hover:text-foreground disabled:opacity-30 h-8 gap-1.5 border"
          disabled={isPending || !canStop || locked}
          onClick={() => onPower("stop")}
          title="Stop"
        >
          <Icon name="pause" className="size-3.5" />
          <span className="hidden sm:inline text-xs">Stop</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-foreground border-border bg-muted/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-30 h-8 gap-1.5 border"
          disabled={isPending || !canKill || locked}
          onClick={() => onPower("kill")}
          title="Kill"
        >
          <Icon name="stop" className="size-3.5" />
          <span className="hidden sm:inline text-xs">Kill</span>
        </Button>
      </div>
    </div>
  )
}
