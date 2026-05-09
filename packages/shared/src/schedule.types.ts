// ---------------------------------------------------------------------------
// Schedule flow shape (panel ↔ API ↔ runner shared contract).
//
// A schedule is a directed graph of nodes. Three kinds:
//
//   - `trigger` — exactly one per schedule. The runner starts execution
//     here when the cron fires.
//   - `action` — does something against the server (power command, console
//     line, take a backup).
//   - `wait` — blocks the runner until a condition is met or its timeout
//     elapses.
//
// `subtype` fully identifies what a node does within its kind. `payload` is
// per-subtype config (the command line, the delay seconds, the wait
// timeout, …). The runner reads `subtype` to decide how to interpret
// `payload`.
//
// The current editor only produces linear chains, but the model is a DAG
// so we can ship branching later without a schema bump.
// ---------------------------------------------------------------------------

export type ScheduleNodeKind = "trigger" | "action" | "wait"

// All trigger subtypes. `cron` is currently the only one; the schedule's
// cron expression lives on the parent `schedules` row, not on the trigger
// node, so the payload is empty.
export type TriggerSubtype = "cron"

// All action subtypes. Each one maps to a concrete daemon call or runner
// helper.
export type ActionSubtype =
  | "power.start"
  | "power.stop"
  | "power.restart"
  | "power.kill"
  | "backup.create"
  | "console.send"

// All wait subtypes. The runner blocks on these until the condition is
// satisfied or `timeoutSeconds` elapses (whichever comes first).
export type WaitSubtype =
  | "state.offline"
  | "state.online"
  | "backup.complete"
  | "delay.seconds"

export type ScheduleNodeSubtype =
  | TriggerSubtype
  | ActionSubtype
  | WaitSubtype

// ---------------------------------------------------------------------------
// Per-subtype payload shapes.
// ---------------------------------------------------------------------------

export type TriggerCronPayload = Record<string, never>

export type PowerActionPayload = Record<string, never>

export type BackupCreatePayload = {
  /** Optional backup name. If empty, the runner stamps `scheduled-<ts>`. */
  name?: string
}

export type ConsoleSendPayload = {
  line: string
}

export type StateWaitPayload = {
  /** Bound on how long the runner will wait. Defaults applied server-side
   *  if absent (60s for offline, 120s for online). */
  timeoutSeconds?: number
}

export type BackupWaitPayload = {
  timeoutSeconds?: number
}

export type DelayPayload = {
  seconds: number
}

export type ScheduleNodePayload =
  | TriggerCronPayload
  | PowerActionPayload
  | BackupCreatePayload
  | ConsoleSendPayload
  | StateWaitPayload
  | BackupWaitPayload
  | DelayPayload

// ---------------------------------------------------------------------------
// Wire shape for nodes + edges (what the API returns and accepts).
// ---------------------------------------------------------------------------

export type ScheduleNode = {
  id: string
  scheduleId: string
  kind: ScheduleNodeKind
  subtype: ScheduleNodeSubtype
  payload: ScheduleNodePayload
  position: { x: number; y: number }
}

export type ScheduleEdge = {
  id: string
  scheduleId: string
  fromNodeId: string
  toNodeId: string
}

export type ScheduleFlow = {
  nodes: ScheduleNode[]
  edges: ScheduleEdge[]
}

// ---------------------------------------------------------------------------
// Helper: a node descriptor for the editor's palette. Each item maps to a
// kind+subtype+default payload — the editor uses these to materialise new
// nodes in response to clicks.
// ---------------------------------------------------------------------------

export type ScheduleNodeDescriptor = {
  kind: ScheduleNodeKind
  subtype: ScheduleNodeSubtype
  /** Human label used in the palette and node header. */
  label: string
  /** One-line description shown in the inspector. */
  description: string
  /** Default payload when the user clicks the palette entry. */
  defaultPayload: ScheduleNodePayload
}

export const NODE_DESCRIPTORS: ScheduleNodeDescriptor[] = [
  {
    kind: "action",
    subtype: "power.start",
    label: "Start server",
    description: "Sends the start power action to the daemon.",
    defaultPayload: {},
  },
  {
    kind: "action",
    subtype: "power.stop",
    label: "Stop server",
    description: "Sends the stop power action (graceful) to the daemon.",
    defaultPayload: {},
  },
  {
    kind: "action",
    subtype: "power.restart",
    label: "Restart server",
    description: "Stops then starts the server in a single locked sequence.",
    defaultPayload: {},
  },
  {
    kind: "action",
    subtype: "power.kill",
    label: "Kill server",
    description: "Force-kills the container (SIGKILL).",
    defaultPayload: {},
  },
  {
    kind: "action",
    subtype: "backup.create",
    label: "Create backup",
    description: "Creates a new backup from the current server files.",
    defaultPayload: { name: "" } satisfies BackupCreatePayload,
  },
  {
    kind: "action",
    subtype: "console.send",
    label: "Send console command",
    description: "Writes a line to the server console (e.g. `say hello`).",
    defaultPayload: { line: "" } satisfies ConsoleSendPayload,
  },
  {
    kind: "wait",
    subtype: "state.offline",
    label: "Wait until offline",
    description: "Blocks until the server reports `offline`.",
    defaultPayload: { timeoutSeconds: 120 } satisfies StateWaitPayload,
  },
  {
    kind: "wait",
    subtype: "state.online",
    label: "Wait until online",
    description: "Blocks until the server reports `running`.",
    defaultPayload: { timeoutSeconds: 300 } satisfies StateWaitPayload,
  },
  {
    kind: "wait",
    subtype: "backup.complete",
    label: "Wait until backup completes",
    description:
      "Blocks until the most recent backup leaves the `pending` state.",
    defaultPayload: { timeoutSeconds: 1800 } satisfies BackupWaitPayload,
  },
  {
    kind: "wait",
    subtype: "delay.seconds",
    label: "Wait N seconds",
    description: "Sleeps for a fixed number of seconds.",
    defaultPayload: { seconds: 30 } satisfies DelayPayload,
  },
]

export const findNodeDescriptor = (
  subtype: ScheduleNodeSubtype
): ScheduleNodeDescriptor | undefined =>
  NODE_DESCRIPTORS.find((d) => d.subtype === subtype)
