import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  type Connection,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"
import {
  Clock,
  Hourglass,
  MessageSquare,
  Play,
  RotateCw,
  Save,
  Settings,
  Skull,
  Square,
  Zap,
  type LucideIcon,
} from "lucide-react"

import "@xyflow/react/dist/style.css"

import {
  NODE_DESCRIPTORS,
  type ScheduleEdge,
  type ScheduleNode,
  type ScheduleNodeDescriptor,
  type ScheduleNodeSubtype,
  findNodeDescriptor,
} from "@workspace/shared/schedule.types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { ScheduleFlowNode } from "@/components/server/ScheduleFlowNode"
import type { ScheduleFlowNodeData } from "@/components/server/ScheduleFlowNode"

type FlowState = {
  nodes: ScheduleNode[]
  edges: ScheduleEdge[]
}

const X_CENTER = 120
const Y_STEP = 140
// Custom MIME the palette items set on dragstart and the canvas reads on
// drop. Keeps the DnD payload distinguishable from random page-level
// drags (e.g. text selections).
const DND_MIME = "application/x-stellar-schedule-subtype"

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

const KIND_STROKE: Record<string, string> = {
  trigger: "#A397E8",
  action: "#f9a8d4",
  wait: "#6ee7b7",
}

const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Array.from({ length: 36 }, () => Math.random().toString(16).slice(2))
    .join("")
    .slice(0, 36)
}

const triggerNode = (): ScheduleNode => ({
  id: newId(),
  scheduleId: "",
  kind: "trigger",
  subtype: "cron",
  payload: {},
  position: { x: X_CENTER, y: 0 },
})

const ensureFlow = (
  flow: FlowState | undefined,
  fallbackTrigger: ScheduleNode
): FlowState => {
  if (flow === undefined || flow.nodes.length === 0) {
    return { nodes: [fallbackTrigger], edges: [] }
  }
  return flow
}

const findTail = (state: FlowState): ScheduleNode | null => {
  const hasOutgoing = new Set(state.edges.map((e) => e.fromNodeId))
  return state.nodes.find((n) => !hasOutgoing.has(n.id)) ?? null
}

// Closest existing node directly above `position` that has no outgoing
// edge — auto-wire target for drag-and-drop drops.
const findClosestAbove = (
  state: FlowState,
  position: { x: number; y: number }
): ScheduleNode | null => {
  const hasOutgoing = new Set(state.edges.map((e) => e.fromNodeId))
  let best: ScheduleNode | null = null
  let bestDy = Number.POSITIVE_INFINITY
  for (const n of state.nodes) {
    if (hasOutgoing.has(n.id)) continue
    const dy = position.y - n.position.y
    if (dy <= 0) continue
    if (dy < bestDy) {
      bestDy = dy
      best = n
    }
  }
  return best
}

// DFS reachability check — adding `from → to` would close a cycle if
// `from` is already reachable from `to`.
const createsCycle = (
  edges: ScheduleEdge[],
  from: string,
  to: string
): boolean => {
  if (from === to) return true
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const list = adj.get(e.fromNodeId) ?? []
    list.push(e.toNodeId)
    adj.set(e.fromNodeId, list)
  }
  const stack = [to]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const cur = stack.pop()
    if (cur === undefined) break
    if (cur === from) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const n of adj.get(cur) ?? []) stack.push(n)
  }
  return false
}

type FlowNode = Node<ScheduleFlowNodeData, "schedule">
type FlowEdge = Edge

const toFlowNodes = (
  state: FlowState,
  selectedId: string | null
): FlowNode[] =>
  state.nodes.map((n) => ({
    id: n.id,
    type: "schedule",
    position: n.position,
    data: {
      kind: n.kind,
      subtype: n.subtype,
      payload: n.payload,
      isSelected: n.id === selectedId,
    },
    selected: n.id === selectedId,
    deletable: n.kind !== "trigger",
  }))

const toFlowEdges = (state: FlowState): FlowEdge[] => {
  const nodeKind = new Map(state.nodes.map((n) => [n.id, n.kind]))
  return state.edges.map((e) => {
    const kind = nodeKind.get(e.fromNodeId) ?? "action"
    const stroke = KIND_STROKE[kind] ?? "#A397E8"
    return {
      id: e.id,
      source: e.fromNodeId,
      target: e.toNodeId,
      type: "smoothstep",
      animated: false,
      pathOptions: { borderRadius: 16 },
      style: { stroke, strokeWidth: 1.5, opacity: 0.7 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 16,
        height: 16,
      },
    }
  })
}

const NODE_TYPES = { schedule: ScheduleFlowNode }

type EditorProps = {
  initialFlow: FlowState | undefined
  onChange: (flow: FlowState) => void
  onSave?: () => void
  onDiscard?: () => void
  title?: string
}

const EditorInner = ({
  initialFlow,
  onChange,
  onSave,
  onDiscard,
  title,
}: EditorProps) => {
  const [trigger] = useState(() => triggerNode())
  const [state, setState] = useState<FlowState>(() =>
    ensureFlow(initialFlow, trigger)
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Pin onChange in a ref so the effect that pushes state up doesn't
  // re-fire when the parent recreates the callback every render.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => {
    onChangeRef.current(state)
  }, [state])

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      fitView({ duration: 250, padding: 0.25 })
    })
    return () => window.cancelAnimationFrame(handle)
  }, [state.nodes.length, fitView])

  const flowNodes = useMemo(
    () => toFlowNodes(state, selectedId),
    [state, selectedId]
  )
  const flowEdges = useMemo(() => toFlowEdges(state), [state])

  const handleNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    // We only care about explicit removes here. Position changes fire
    // continuously during drag and are committed once on drag stop.
    const removedIds = new Set<string>()
    for (const c of changes) {
      if (c.type === "remove") removedIds.add(c.id)
    }
    if (removedIds.size === 0) return
    setState((prev) => ({
      nodes: prev.nodes.filter((n) => !removedIds.has(n.id)),
      edges: prev.edges.filter(
        (e) => !removedIds.has(e.fromNodeId) && !removedIds.has(e.toNodeId)
      ),
    }))
  }, [])

  const handleNodeDragStop = useCallback(
    (_e: unknown, dragged: FlowNode) => {
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === dragged.id ? { ...n, position: dragged.position } : n
        ),
      }))
    },
    []
  )

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: FlowNode[] }) => {
      setSelectedId(nodes[0]?.id ?? null)
    },
    []
  )

  const appendNode = useCallback((descriptor: ScheduleNodeDescriptor) => {
    setState((prev) => {
      const tail = findTail(prev)
      const tailPos = tail?.position ?? { x: X_CENTER, y: 0 }
      const newNode: ScheduleNode = {
        id: newId(),
        scheduleId: "",
        kind: descriptor.kind,
        subtype: descriptor.subtype,
        payload: { ...descriptor.defaultPayload } as Record<string, unknown>,
        position: { x: tailPos.x, y: tailPos.y + Y_STEP },
      }
      const nodes = [...prev.nodes, newNode]
      const edges = [...prev.edges]
      if (tail !== null) {
        edges.push({
          id: newId(),
          scheduleId: "",
          fromNodeId: tail.id,
          toNodeId: newNode.id,
        })
      }
      return { nodes, edges }
    })
  }, [])

  // ---------------------------------------------------------------------
  // Drag-and-drop from the palette: dragstart on a palette item sets the
  // subtype on the DataTransfer, the canvas read it on drop, materialises
  // a new node at the cursor flow-coordinates, and auto-wires an edge
  // from the closest unwired node above it.
  // ---------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes(DND_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const subtype = e.dataTransfer.getData(DND_MIME)
      if (subtype === "") return
      e.preventDefault()
      const descriptor = NODE_DESCRIPTORS.find((d) => d.subtype === subtype)
      if (descriptor === undefined) return
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      setState((prev) => {
        const newNode: ScheduleNode = {
          id: newId(),
          scheduleId: "",
          kind: descriptor.kind,
          subtype: descriptor.subtype,
          payload: { ...descriptor.defaultPayload } as Record<string, unknown>,
          position,
        }
        const above = findClosestAbove(prev, position)
        const edges = [...prev.edges]
        if (above !== null) {
          edges.push({
            id: newId(),
            scheduleId: "",
            fromNodeId: above.id,
            toNodeId: newNode.id,
          })
        }
        return { nodes: [...prev.nodes, newNode], edges }
      })
    },
    [screenToFlowPosition]
  )

  // Manual edge creation via xyflow's connect handle drag. Validates
  // client-side; the API also enforces these on save.
  const handleConnect = useCallback((params: Connection) => {
    const { source, target } = params
    if (source === null || target === null) return
    setState((prev) => {
      // Reject self-loops, edges into the trigger, duplicates, cycles.
      if (source === target) return prev
      const targetNode = prev.nodes.find((n) => n.id === target)
      if (targetNode === undefined || targetNode.kind === "trigger") return prev
      if (
        prev.edges.some(
          (e) => e.fromNodeId === source && e.toNodeId === target
        )
      ) {
        return prev
      }
      if (createsCycle(prev.edges, source, target)) return prev
      return {
        ...prev,
        edges: [
          ...prev.edges,
          { id: newId(), scheduleId: "", fromNodeId: source, toNodeId: target },
        ],
      }
    })
  }, [])

  const updateSelectedPayload = useCallback(
    (payload: Record<string, unknown>) => {
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === selectedId ? { ...n, payload } : n
        ),
      }))
    },
    [selectedId]
  )

  const deleteSelected = useCallback(() => {
    if (selectedId === null) return
    const node = state.nodes.find((n) => n.id === selectedId)
    if (node === undefined || node.kind === "trigger") return
    setState((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== selectedId),
      edges: prev.edges.filter(
        (e) => e.fromNodeId !== selectedId && e.toNodeId !== selectedId
      ),
    }))
    setSelectedId(null)
  }, [selectedId, state.nodes])

  const selectedNode = useMemo(
    () => state.nodes.find((n) => n.id === selectedId) ?? null,
    [state.nodes, selectedId]
  )

  const isEmpty = state.nodes.length === 1 && state.nodes[0]?.kind === "trigger"

  return (
    <div className="flex h-[70vh] min-h-[540px] flex-col rounded-md border bg-background">
      <Toolbar title={title} onSave={onSave} onDiscard={onDiscard} />

      <div className="grid flex-1 grid-cols-[220px_1fr_260px] gap-px bg-white/5">
        <Palette onAdd={appendNode} />

        <div
          ref={wrapperRef}
          className="relative overflow-hidden bg-[#0c0a08]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={handleNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            onConnect={handleConnect}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            panOnDrag
            selectionOnDrag={false}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              gap={20}
              size={1}
              color="rgba(255,255,255,0.06)"
            />
            <Controls
              showInteractive={false}
              className="overflow-hidden rounded-md !border !border-white/10 !bg-[#201c19] !shadow-lg [&_button]:!border-white/8 [&_button]:!bg-[#201c19] [&_button]:!text-zinc-300 [&_button:hover]:!bg-white/10 [&_svg]:!fill-current"
            />
          </ReactFlow>
          {isEmpty ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md border border-white/8 bg-[#201c19]/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
                Drag an action from the left, or click to append it to the chain.
              </p>
            </div>
          ) : null}
        </div>

        <Inspector
          node={selectedNode}
          onChangePayload={updateSelectedPayload}
          onDelete={deleteSelected}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

const Toolbar = ({
  title,
  onSave,
  onDiscard,
}: {
  title?: string
  onSave?: () => void
  onDiscard?: () => void
}) => (
  <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-3">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{title ?? "Schedule flow"}</span>
      <span className="rounded-sm bg-[#A397E8]/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[#A397E8]">
        Draft
      </span>
    </div>
    <div className="flex items-center gap-2">
      {onDiscard !== undefined ? (
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
      ) : null}
      {onSave !== undefined ? (
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
      ) : null}
      <Button variant="ghost" size="icon-sm" aria-label="Settings">
        <Settings className="size-3.5" />
      </Button>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Palette — three groups (Power / Actions / Delays). Items are click-to-
// append AND drag-to-place.
// ---------------------------------------------------------------------------

const Palette = ({
  onAdd,
}: {
  onAdd: (descriptor: ScheduleNodeDescriptor) => void
}) => {
  const groups = useMemo(() => {
    const power = NODE_DESCRIPTORS.filter((d) =>
      d.subtype.startsWith("power.")
    )
    const actions = NODE_DESCRIPTORS.filter(
      (d) =>
        d.kind === "action" &&
        !d.subtype.startsWith("power.")
    )
    const delays = NODE_DESCRIPTORS.filter((d) => d.kind === "wait")
    return { power, actions, delays }
  }, [])
  return (
    <div className="flex flex-col gap-4 overflow-y-auto bg-background p-3">
      <PaletteGroup label="Power" items={groups.power} onAdd={onAdd} />
      <PaletteGroup label="Actions" items={groups.actions} onAdd={onAdd} />
      <PaletteGroup label="Delays" items={groups.delays} onAdd={onAdd} />
    </div>
  )
}

const PaletteGroup = ({
  label,
  items,
  onAdd,
}: {
  label: string
  items: ScheduleNodeDescriptor[]
  onAdd: (descriptor: ScheduleNodeDescriptor) => void
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </span>
    <ul className="flex flex-col">
      {items.map((it) => {
        const Icon = SUBTYPE_ICON[it.subtype] ?? Zap
        return (
          <li key={it.subtype}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_MIME, it.subtype)
                e.dataTransfer.effectAllowed = "move"
              }}
              onClick={() => onAdd(it)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-white/5"
              title={it.description}
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              <span className="truncate">{it.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  </div>
)

// ---------------------------------------------------------------------------
// Inspector — coloured eyebrow + title matching the selected node's kind.
// ---------------------------------------------------------------------------

const KIND_TINT: Record<
  string,
  { eyebrow: string; title: string }
> = {
  trigger: { eyebrow: "text-[#A397E8]/70", title: "text-[#A397E8]" },
  action: { eyebrow: "text-pink-300/70", title: "text-pink-300" },
  wait: { eyebrow: "text-emerald-300/70", title: "text-emerald-300" },
}

const Inspector = ({
  node,
  onChangePayload,
  onDelete,
}: {
  node: ScheduleNode | null
  onChangePayload: (payload: Record<string, unknown>) => void
  onDelete: () => void
}) => {
  if (node === null) {
    return (
      <div className="flex flex-col gap-2 bg-background p-3 text-xs text-muted-foreground">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
          Inspector
        </span>
        <p className="leading-relaxed">
          Select a node on the canvas to edit it. Drag from the palette on
          the left to drop new ones, or use the handles below each node to
          wire connections by hand.
        </p>
      </div>
    )
  }

  const descriptor = findNodeDescriptor(node.subtype)
  const tint = KIND_TINT[node.kind] ?? KIND_TINT.action!

  return (
    <div className="flex flex-col gap-3 overflow-y-auto bg-background p-3">
      <div className="flex flex-col gap-1">
        <span
          className={`text-[10px] font-medium uppercase tracking-[0.18em] ${tint.eyebrow}`}
        >
          {node.kind === "trigger"
            ? "Trigger"
            : node.kind === "action"
              ? "Action"
              : "Wait"}
        </span>
        <span className={`text-sm font-semibold ${tint.title}`}>
          {descriptor?.label ?? node.subtype}
        </span>
        {descriptor !== undefined ? (
          <span className="text-xs font-extralight text-muted-foreground">
            {descriptor.description}
          </span>
        ) : null}
      </div>

      <PayloadEditor
        subtype={node.subtype}
        payload={node.payload}
        onChange={onChangePayload}
      />

      {node.kind !== "trigger" ? (
        <button
          type="button"
          onClick={onDelete}
          className="self-start text-xs font-medium text-red-400 transition-opacity hover:opacity-80"
        >
          Delete node
        </button>
      ) : null}
    </div>
  )
}

const PayloadEditor = ({
  subtype,
  payload,
  onChange,
}: {
  subtype: ScheduleNodeSubtype
  payload: Record<string, unknown>
  onChange: (payload: Record<string, unknown>) => void
}) => {
  if (subtype === "delay.seconds") {
    return (
      <NumberField
        label="Seconds"
        value={Number(payload["seconds"] ?? 0)}
        onChange={(v) => onChange({ ...payload, seconds: v })}
      />
    )
  }
  if (subtype === "console.send") {
    return (
      <TextField
        label="Console line"
        placeholder="say backup completed"
        value={String(payload["line"] ?? "")}
        onChange={(v) => onChange({ ...payload, line: v })}
      />
    )
  }
  if (subtype === "backup.create") {
    return (
      <TextField
        label="Backup name (optional)"
        placeholder="leave blank for auto-stamp"
        value={String(payload["name"] ?? "")}
        onChange={(v) => onChange({ ...payload, name: v })}
      />
    )
  }
  if (
    subtype === "state.offline" ||
    subtype === "state.online" ||
    subtype === "backup.complete"
  ) {
    return (
      <NumberField
        label="Timeout (seconds)"
        value={Number(payload["timeoutSeconds"] ?? 0)}
        onChange={(v) => onChange({ ...payload, timeoutSeconds: v })}
      />
    )
  }
  return null
}

const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    <Input
      type="number"
      min={0}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = Number(e.currentTarget.value)
        onChange(Number.isFinite(n) ? n : 0)
      }}
    />
  </div>
)

const TextField = ({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    <Input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  </div>
)

export const ScheduleFlowEditor = (props: EditorProps) => (
  <ReactFlowProvider>
    <EditorInner {...props} />
  </ReactFlowProvider>
)
