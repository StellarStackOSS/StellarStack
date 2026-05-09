import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import {
  NODE_DESCRIPTORS,
  type ScheduleEdge,
  type ScheduleNode,
  type ScheduleNodeDescriptor,
  type ScheduleNodeKind,
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
const Y_STEP = 120

// Generate v4-ish UUIDs without pulling in a dep — server validates with
// `z.string().uuid()` so format matters. crypto.randomUUID is available in
// modern browsers.
const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // Fallback unlikely to hit in this app but keeps types safe.
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

// Find the "tail" of a linear chain (the only node with no outgoing edge).
const findTail = (state: FlowState): ScheduleNode | null => {
  const hasOutgoing = new Set(state.edges.map((e) => e.fromNodeId))
  return state.nodes.find((n) => !hasOutgoing.has(n.id)) ?? null
}

// ---------------------------------------------------------------------------
// xyflow ↔ ScheduleFlow translation
// ---------------------------------------------------------------------------

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

const toFlowEdges = (state: FlowState): FlowEdge[] =>
  state.edges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    type: "smoothstep",
    animated: false,
    style: { stroke: "var(--border)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border)" },
  }))

// ---------------------------------------------------------------------------
// Editor inner — needs to be inside a ReactFlowProvider so we can use
// `useReactFlow` for coordinate fitting / programmatic ops.
// ---------------------------------------------------------------------------

const NODE_TYPES = { schedule: ScheduleFlowNode }

type EditorProps = {
  initialFlow: FlowState | undefined
  onChange: (flow: FlowState) => void
}

const EditorInner = ({ initialFlow, onChange }: EditorProps) => {
  const [trigger] = useState(() => triggerNode())
  const [state, setState] = useState<FlowState>(() =>
    ensureFlow(initialFlow, trigger)
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { fitView } = useReactFlow()

  // Pin the latest `onChange` in a ref so the effect that pushes state
  // upward doesn't re-fire when the parent recreates the callback. (Without
  // this, every parent render → new onChange ref → effect re-runs → parent
  // setState → loop.)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Push state changes outward exactly once per state mutation.
  useEffect(() => {
    onChangeRef.current(state)
  }, [state])

  // Refit the viewport whenever the node count changes. xyflow needs a
  // frame to measure new nodes' dimensions; a `setTimeout` from the click
  // handler races that, so we drive the fit from a layout effect instead.
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

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      // Only commit explicit removes from this stream — position changes
      // fire continuously during drag and updating my React state from
      // each one causes a re-render storm (memos recompute, parent
      // re-renders) that xyflow renders as a flicker. Position is
      // committed once in `handleNodeDragStop` instead.
      const removedIds = new Set<string>()
      for (const c of changes) {
        if (c.type === "remove") removedIds.add(c.id)
      }
      if (removedIds.size === 0) return
      setState((prev) => ({
        nodes: prev.nodes.filter((n) => !removedIds.has(n.id)),
        edges: prev.edges.filter(
          (e) =>
            !removedIds.has(e.fromNodeId) && !removedIds.has(e.toNodeId)
        ),
      }))
    },
    []
  )

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

  const appendNode = useCallback(
    (descriptor: ScheduleNodeDescriptor) => {
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
      // Refit is driven by the useEffect on `state.nodes.length`.
    },
    []
  )

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

  return (
    <div className="grid h-[60vh] min-h-[480px] grid-cols-[200px_1fr_240px] gap-3 rounded-md border bg-background">
      <Palette onAdd={appendNode} />

      <div className="relative overflow-hidden border-x">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onSelectionChange={handleSelectionChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          selectionOnDrag={false}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Inspector
        node={selectedNode}
        onChangePayload={updateSelectedPayload}
        onDelete={deleteSelected}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Palette — categorised list of node descriptors. Click → append.
// ---------------------------------------------------------------------------

const Palette = ({
  onAdd,
}: {
  onAdd: (descriptor: ScheduleNodeDescriptor) => void
}) => {
  const grouped = useMemo(() => {
    const actions = NODE_DESCRIPTORS.filter((d) => d.kind === "action")
    const waits = NODE_DESCRIPTORS.filter((d) => d.kind === "wait")
    return { actions, waits }
  }, [])
  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      <PaletteGroup
        label="Actions"
        items={grouped.actions}
        kind="action"
        onAdd={onAdd}
      />
      <PaletteGroup
        label="Waits"
        items={grouped.waits}
        kind="wait"
        onAdd={onAdd}
      />
    </div>
  )
}

const PaletteGroup = ({
  label,
  items,
  kind,
  onAdd,
}: {
  label: string
  items: ScheduleNodeDescriptor[]
  kind: ScheduleNodeKind
  onAdd: (descriptor: ScheduleNodeDescriptor) => void
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li key={it.subtype}>
          <button
            type="button"
            onClick={() => onAdd(it)}
            className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:border-border hover:bg-muted"
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                kind === "action" ? "bg-chart-1" : "bg-chart-3"
              }`}
            />
            <span className="truncate">{it.label}</span>
          </button>
        </li>
      ))}
    </ul>
  </div>
)

// ---------------------------------------------------------------------------
// Inspector — edits the selected node's payload.
// ---------------------------------------------------------------------------

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
      <div className="flex flex-col gap-2 p-3 text-xs text-muted-foreground">
        <span className="text-[10px] font-medium uppercase tracking-wider">
          Inspector
        </span>
        <p className="leading-relaxed">
          Select a node on the canvas to edit it. Use the palette on the left
          to append nodes to the chain.
        </p>
      </div>
    )
  }

  const descriptor = findNodeDescriptor(node.subtype)

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {node.kind === "trigger"
            ? "Trigger"
            : node.kind === "action"
              ? "Action"
              : "Wait"}
        </span>
        <span className="text-sm font-medium">
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
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={onDelete}
        >
          Delete node
        </Button>
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

// ---------------------------------------------------------------------------
// Public entry point — wraps the editor in ReactFlowProvider.
// ---------------------------------------------------------------------------

export const ScheduleFlowEditor = (props: EditorProps) => (
  <ReactFlowProvider>
    <EditorInner {...props} />
  </ReactFlowProvider>
)
