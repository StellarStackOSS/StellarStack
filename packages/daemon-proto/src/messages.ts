import { z } from "zod"

import { blueprintLifecycleSchema } from "@workspace/shared/blueprint"
import { panelEventSchema } from "@workspace/shared/events"

const reasonSchema = z.object({
  code: z.string(),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
})

const stateSchema = z.enum([
  "installing",
  "installed_stopped",
  "starting",
  "running",
  "stopping",
  "stopped",
  "crashed",
])

const helloSchema = z.object({
  type: z.literal("daemon.hello"),
  nodeId: z.string().min(1),
  daemonVersion: z.string().min(1),
  protocolVersion: z.number().int().positive(),
  capabilities: z.array(z.string()),
})

const ackSchema = z
  .object({ type: z.literal("ack") })
  .catchall(z.unknown())

const errorSchema = z.object({
  type: z.literal("error"),
  code: z.string(),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
})

const createContainerSchema = z.object({
  type: z.literal("server.create_container"),
  serverId: z.string(),
  dockerImage: z.string(),
  memoryLimitMb: z.number().int().nonnegative(),
  cpuLimitPercent: z.number().int().nonnegative(),
  diskLimitMb: z.number().int().nonnegative(),
  environment: z.record(z.string(), z.string()),
  portMappings: z.array(
    z.object({
      ip: z.string(),
      port: z.number().int().min(1).max(65535),
      containerPort: z.number().int().min(1).max(65535),
    })
  ),
  startupCommand: z.string(),
  stopSignal: z.string(),
  lifecycle: blueprintLifecycleSchema,
})

const runInstallSchema = z.object({
  type: z.literal("server.run_install"),
  serverId: z.string(),
  install: z.object({
    image: z.string(),
    entrypoint: z.string(),
    script: z.string(),
  }),
  environment: z.record(z.string(), z.string()),
})

const simpleServerActionSchema = z.object({
  type: z.enum(["server.start", "server.stop", "server.kill"]),
  serverId: z.string(),
})

const deleteServerSchema = z.object({
  type: z.literal("server.delete"),
  serverId: z.string(),
  deleteFiles: z.boolean(),
})

const stateChangedSchema = z.object({
  type: z.literal("server.state_changed"),
  serverId: z.string(),
  from: stateSchema,
  to: stateSchema,
  reason: reasonSchema,
  at: z.string(),
})

const statsSchema = z.object({
  type: z.literal("server.stats"),
  serverId: z.string(),
  memoryBytes: z.number().nonnegative(),
  memoryLimitBytes: z.number().nonnegative(),
  cpuFraction: z.number().nonnegative(),
  diskBytes: z.number().nonnegative(),
  networkRxBytes: z.number().nonnegative(),
  networkTxBytes: z.number().nonnegative(),
  at: z.string(),
})

const installLogSchema = z.object({
  type: z.literal("server.install_log"),
  serverId: z.string(),
  stream: z.enum(["stdout", "stderr"]),
  line: z.string(),
  at: z.string(),
})

const consoleLogSchema = z.object({
  type: z.literal("server.console"),
  serverId: z.string(),
  line: z.string(),
  at: z.string(),
})

const createBackupSchema = z.object({
  type: z.literal("server.create_backup"),
  serverId: z.string(),
  name: z.string(),
})

const restoreBackupSchema = z.object({
  type: z.literal("server.restore_backup"),
  serverId: z.string(),
  name: z.string(),
})

const deleteBackupSchema = z.object({
  type: z.literal("server.delete_backup"),
  serverId: z.string(),
  name: z.string(),
  s3: z
    .object({
      endpoint: z.string(),
      region: z.string(),
      bucket: z.string(),
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      forcePathStyle: z.boolean(),
      key: z.string(),
    })
    .optional(),
})

const uploadBackupS3Schema = z.object({
  type: z.literal("server.upload_backup_s3"),
  serverId: z.string(),
  name: z.string(),
  endpoint: z.string(),
  region: z.string(),
  bucket: z.string(),
  prefix: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  forcePathStyle: z.boolean(),
  sha256: z.string(),
})

/**
 * Zod schema for the worker↔daemon message union. Daemons validate inbound
 * frames against this; workers validate before publishing to the panel WS.
 */
export const daemonMessageSchema = z.union([
  helloSchema,
  ackSchema,
  errorSchema,
  createContainerSchema,
  runInstallSchema,
  simpleServerActionSchema,
  deleteServerSchema,
  stateChangedSchema,
  statsSchema,
  installLogSchema,
  consoleLogSchema,
  createBackupSchema,
  restoreBackupSchema,
  deleteBackupSchema,
  uploadBackupS3Schema,
])

/**
 * Zod schema for the envelope wrapping each message.
 */
export const daemonEnvelopeSchema = z.object({
  id: z.union([z.string(), z.null()]),
  message: daemonMessageSchema,
})

/**
 * Daemon-emitted state and stats events also flow into the panel-event
 * fanout. Re-export the corresponding panel-event schema so daemon-proto
 * consumers don't have to depend on `@workspace/shared/events` separately
 * for that shape.
 */
export const panelEventSchemaRef = panelEventSchema

/**
 * Pub/sub envelope bridging the worker and the API's daemon WebSocket.
 * Workers don't connect to daemons directly — the API holds every daemon
 * socket. A worker publishes a `BridgeEnvelope` to `DAEMON_CMD_CHANNEL`,
 * the API forwards the inner `envelope` to the matching daemon, and any
 * frame the daemon sends back is rebroadcast as a `BridgeEnvelope` on
 * `DAEMON_RESP_CHANNEL` for any worker to correlate by `envelope.id`.
 */
export const daemonBridgeEnvelopeSchema = z.object({
  nodeId: z.string().min(1),
  envelope: daemonEnvelopeSchema,
})
