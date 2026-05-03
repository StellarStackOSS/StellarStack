import { HugeiconsIcon } from "@hugeicons/react"
import {
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  StopIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"

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
    <div className="flex h-full items-center justify-between rounded-xl border border-white/[0.07] bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] px-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      {/* left: name + status */}
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-base font-semibold text-zinc-100">
          {server.name}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={[
              "size-1.5 rounded-full",
              STATUS_DOT[status] ?? "bg-zinc-600",
            ].join(" ")}
          />
          <span className="text-xs text-zinc-500">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      {/* right: power controls */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 border border-white/[0.07] bg-white/5 text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 disabled:opacity-30"
          disabled={isPending || !canStart || locked}
          onClick={() => onPower("start")}
          title="Start"
        >
          <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
          <span className="hidden sm:inline text-xs">Start</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 border border-white/[0.07] bg-white/5 text-zinc-300 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 disabled:opacity-30"
          disabled={isPending || !canRestart || locked}
          onClick={() => onPower("restart")}
          title="Restart"
        >
          <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
          <span className="hidden sm:inline text-xs">Restart</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 border border-white/[0.07] bg-white/5 text-zinc-300 hover:bg-zinc-500/10 hover:text-zinc-300 hover:border-zinc-500/20 disabled:opacity-30"
          disabled={isPending || !canStop || locked}
          onClick={() => onPower("stop")}
          title="Stop"
        >
          <HugeiconsIcon icon={PauseIcon} className="size-3.5" />
          <span className="hidden sm:inline text-xs">Stop</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 border border-white/[0.07] bg-white/5 text-zinc-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-30"
          disabled={isPending || !canKill || locked}
          onClick={() => onPower("kill")}
          title="Kill"
        >
          <HugeiconsIcon icon={StopIcon} className="size-3.5" />
          <span className="hidden sm:inline text-xs">Kill</span>
        </Button>
      </div>
    </div>
  )
}
