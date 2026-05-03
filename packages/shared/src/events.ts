import { z } from "zod"

/**
 * Lifecycle state Zod schema. Mirrors the four-state machine the daemon
 * runs (offline → starting → running → stopping → offline). Install /
 * restore are tracked on the server row as separate boolean flags, not as
 * lifecycle states.
 */
export const lifecycleStateSchema = z.enum([
  "offline",
  "starting",
  "running",
  "stopping",
])

export const lifecycleStates = lifecycleStateSchema.options

/**
 * Reason metadata for a state transition. `code` is a translation key in
 * the `servers.lifecycle.*` namespace; `params` are interpolation values.
 */
export const lifecycleReasonSchema = z.object({
  code: z.string(),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
})

/**
 * Payload sent over the daemon WS as `{event:"status", args:[state]}` and
 * by the daemon's HTTP status callback as `{previous_state, new_state}`.
 * Kept as a Zod schema so both API and web can validate without sharing
 * runtime code.
 */
export const stateChangedPayloadSchema = z.object({
  previousState: lifecycleStateSchema,
  newState: lifecycleStateSchema,
  reason: lifecycleReasonSchema.optional(),
  at: z.string(),
})

/**
 * Stats payload broadcast over the daemon WS as `{event:"stats", args:[…]}`.
 * Field names match Pelican's wire format (snake_case) so existing tooling
 * and docs remain useful for debugging.
 */
export const statsPayloadSchema = z.object({
  memory_bytes: z.number().nonnegative(),
  memory_limit_bytes: z.number().nonnegative(),
  cpu_absolute: z.number().nonnegative(),
  network: z.object({
    rx_bytes: z.number().nonnegative(),
    tx_bytes: z.number().nonnegative(),
  }),
  disk_bytes: z.number().nonnegative(),
  disk_read_bytes: z.number().nonnegative(),
  disk_write_bytes: z.number().nonnegative(),
  uptime_ms: z.number().nonnegative().optional(),
  state: lifecycleStateSchema,
})

/**
 * Envelope schema for every frame on the per-server daemon WebSocket.
 * Pelican-shape: `{event, args}` discriminated by `event`.
 */
export const wsEnvelopeSchema = z.object({
  event: z.string(),
  args: z.array(z.unknown()).default([]),
})
