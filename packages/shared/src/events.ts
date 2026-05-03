import { z } from "zod"

const reasonSchema = z.object({
  code: z.string(),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
})

const lifecycleStateSchema = z.enum([
  "installing",
  "installed_stopped",
  "starting",
  "running",
  "stopping",
  "stopped",
  "crashed",
  "restoring_backup",
])

const serverStateChangedSchema = z.object({
  type: z.literal("server.state.changed"),
  serverId: z.string(),
  from: lifecycleStateSchema,
  to: lifecycleStateSchema,
  reason: reasonSchema,
  at: z.string(),
})

const serverStatsSchema = z.object({
  type: z.literal("server.stats"),
  serverId: z.string(),
  memoryBytes: z.number().nonnegative(),
  memoryLimitBytes: z.number().nonnegative(),
  cpuFraction: z.number().nonnegative(),
  diskBytes: z.number().nonnegative(),
  networkRxBytes: z.number().nonnegative(),
  networkTxBytes: z.number().nonnegative(),
  diskReadBytes: z.number().nonnegative().default(0),
  diskWriteBytes: z.number().nonnegative().default(0),
  startedAt: z.string().optional(),
  at: z.string(),
})

const nodeDaemonStatusSchema = z.object({
  type: z.literal("node.daemon.status"),
  nodeId: z.string(),
  connected: z.boolean(),
  at: z.string(),
})

const jobProgressSchema = z.object({
  type: z.literal("job.progress"),
  jobId: z.string(),
  serverId: z.string().optional(),
  jobType: z.string(),
  percent: z.number().min(0).max(100),
  message: reasonSchema.optional(),
  at: z.string(),
})

const serverInstallLogSchema = z.object({
  type: z.literal("server.install_log"),
  serverId: z.string(),
  stream: z.enum(["stdout", "stderr"]),
  line: z.string(),
  at: z.string(),
})

/**
 * Zod schema for the panel WS event union. Used by both producer (worker) and
 * consumer (web) sides to validate before publish/dispatch.
 */
export const panelEventSchema = z.discriminatedUnion("type", [
  serverStateChangedSchema,
  serverStatsSchema,
  jobProgressSchema,
  nodeDaemonStatusSchema,
  serverInstallLogSchema,
])

export const lifecycleStates = lifecycleStateSchema.options
