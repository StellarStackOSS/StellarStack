import { Handle, type NodeProps, Position } from "@xyflow/react"

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

const KIND_DOT: Record<ScheduleNodeKind, string> = {
  trigger: "bg-foreground",
  action: "bg-chart-1",
  wait: "bg-chart-3",
}

const KIND_LABEL: Record<ScheduleNodeKind, string> = {
  trigger: "Trigger",
  action: "Action",
  wait: "Wait",
}

// Render a one-line summary of the payload to give a glance-y read of what
// the node will do without opening the inspector.
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
  return null
}

export const ScheduleFlowNode = ({
  data,
}: NodeProps<{ id: string; type: "schedule"; data: ScheduleFlowNodeData; position: { x: number; y: number } }>) => {
  const descriptor = findNodeDescriptor(data.subtype)
  const summary = summarisePayload(data.subtype, data.payload)
  return (
    <div
      className={`flex min-w-[220px] flex-col gap-1 rounded-md border bg-[#201c19] px-3 py-2 text-xs shadow-lg shadow-black/40 transition-colors ${
        data.isSelected
          ? "border-white/40 ring-1 ring-white/20"
          : "border-white/15"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`size-1.5 shrink-0 rounded-full ${KIND_DOT[data.kind]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {KIND_LABEL[data.kind]}
        </span>
      </div>
      <div className="text-sm font-medium text-foreground">
        {descriptor?.label ?? data.subtype}
      </div>
      {summary !== null ? (
        <div className="truncate font-mono text-[10.5px] text-muted-foreground">
          {summary}
        </div>
      ) : null}

      {/* Linear chain — non-trigger nodes accept incoming edges, all but the
          tail emit one outgoing edge. xyflow requires the handles to be
          declared even when we render edges programmatically. */}
      {data.kind !== "trigger" ? (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          style={{ background: "transparent", border: "none" }}
        />
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ background: "transparent", border: "none" }}
      />
    </div>
  )
}
