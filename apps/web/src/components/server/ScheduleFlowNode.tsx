import { Handle, type NodeProps, Position } from "@xyflow/react"
import {
  Clock,
  Hourglass,
  MessageSquare,
  Play,
  RotateCw,
  Save,
  Skull,
  Square,
  Zap,
  type LucideIcon,
} from "lucide-react"

import {
  type ScheduleNodeKind,
  type ScheduleNodeSubtype,
  findNodeDescriptor,
} from "@workspace/shared/schedule.types"

export type ScheduleFlowNodeData = {
  kind: ScheduleNodeKind
  subtype: ScheduleNodeSubtype
  payload: Record<string, unknown>
  isSelected: boolean
}

const KIND_LABEL: Record<ScheduleNodeKind, string> = {
  trigger: "Trigger",
  action: "Action",
  wait: "Wait",
}

const SUBTYPE_ICON: Record<ScheduleNodeSubtype, LucideIcon> = {
  cron: Zap,
  "power.start": Play,
  "power.stop": Square,
  "power.restart": RotateCw,
  "power.kill": Skull,
  "backup.create": Save,
  "console.send": MessageSquare,
  "state.offline": Hourglass,
  "state.online": Hourglass,
  "backup.complete": Hourglass,
  "delay.seconds": Clock,
}

type KindStyle = {
  surface: string
  border: string
  borderSelected: string
  ring: string
  title: string
  icon: string
  eyebrow: string
}

const KIND_STYLE: Record<ScheduleNodeKind, KindStyle> = {
  trigger: {
    surface: "bg-[#A397E8]/8",
    border: "border-[#A397E8]/30",
    borderSelected: "border-[#A397E8]/70",
    ring: "ring-[#A397E8]/25",
    title: "text-[#A397E8]",
    icon: "text-[#A397E8]",
    eyebrow: "text-[#A397E8]/70",
  },
  action: {
    surface: "bg-pink-400/6",
    border: "border-pink-400/25",
    borderSelected: "border-pink-300/70",
    ring: "ring-pink-400/20",
    title: "text-pink-300",
    icon: "text-pink-300",
    eyebrow: "text-pink-300/70",
  },
  wait: {
    surface: "bg-emerald-400/6",
    border: "border-emerald-400/25",
    borderSelected: "border-emerald-300/70",
    ring: "ring-emerald-400/20",
    title: "text-emerald-300",
    icon: "text-emerald-300",
    eyebrow: "text-emerald-300/70",
  },
}

const summarisePayload = (
  subtype: ScheduleNodeSubtype,
  payload: Record<string, unknown>
): string | null => {
  if (subtype === "delay.seconds") {
    const s = Number(payload["seconds"] ?? 0)
    return Number.isFinite(s) && s > 0 ? `${s}s` : null
  }
  if (subtype === "console.send") {
    const line = typeof payload["line"] === "string" ? payload["line"] : ""
    return line.length > 0 ? `> ${line}` : null
  }
  if (subtype === "backup.create") {
    const name = typeof payload["name"] === "string" ? payload["name"] : ""
    return name.length > 0 ? name : "auto-stamp"
  }
  if (
    subtype === "state.offline" ||
    subtype === "state.online" ||
    subtype === "backup.complete"
  ) {
    const t = Number(payload["timeoutSeconds"] ?? 0)
    return Number.isFinite(t) && t > 0 ? `timeout ${t}s` : null
  }
  if (subtype === "cron") {
    return "When the cron fires"
  }
  return null
}

export const ScheduleFlowNode = ({
  data,
}: NodeProps<{
  id: string
  type: "schedule"
  data: ScheduleFlowNodeData
  position: { x: number; y: number }
}>) => {
  const descriptor = findNodeDescriptor(data.subtype)
  const summary = summarisePayload(data.subtype, data.payload)
  const style = KIND_STYLE[data.kind]
  const Icon = SUBTYPE_ICON[data.subtype] ?? Zap

  return (
    <div
      className={`relative flex min-w-[220px] flex-col gap-1 rounded-lg border px-3 py-2 text-xs shadow-lg shadow-black/40 backdrop-blur-sm transition-all ${
        style.surface
      } ${
        data.isSelected
          ? `${style.borderSelected} ring-2 ${style.ring}`
          : style.border
      }`}
    >
      {data.kind === "trigger" ? (
        <span
          className={`absolute right-2 top-2 rounded-sm bg-[#A397E8]/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${style.title}`}
        >
          IF
        </span>
      ) : null}

      <div
        className={`text-[9px] font-semibold uppercase tracking-wider ${style.eyebrow}`}
      >
        {KIND_LABEL[data.kind]}
      </div>
      <div className="flex items-center gap-2">
        <Icon className={`size-3.5 shrink-0 ${style.icon}`} />
        <span className={`text-sm font-semibold ${style.title}`}>
          {descriptor?.label ?? data.subtype}
        </span>
      </div>
      {summary !== null ? (
        <div className="truncate font-mono text-[10.5px] text-muted-foreground">
          {summary}
        </div>
      ) : null}

      {data.kind !== "trigger" ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-2 !border-white/20 !bg-[#201c19]"
        />
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-white/20 !bg-[#201c19]"
      />
    </div>
  )
}
