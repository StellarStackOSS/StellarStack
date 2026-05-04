import { z } from "zod"

const localizableTextSchema = z.union([
  z.string(),
  z.object({
    key: z.string().min(1),
    params: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  }),
])

const variableSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[A-Z][A-Z0-9_]*$/, {
      message: "Variable keys must be UPPER_SNAKE_CASE",
    }),
  name: localizableTextSchema,
  description: localizableTextSchema.optional(),
  default: z.string(),
  userViewable: z.boolean(),
  userEditable: z.boolean(),
  rules: z.string().min(1),
})

const configFileSchema = z.object({
  path: z.string().min(1),
  parser: z.enum(["properties", "json", "yaml", "ini", "toml", "xml"]),
  patches: z.record(z.string(), z.string()),
})

const matchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("regex"),
    pattern: z.string().min(1),
    flags: z.string().optional(),
  }),
  z.object({ type: z.literal("substring"), value: z.string().min(1) }),
])

const probeSchema = z.discriminatedUnion("strategy", [
  z.object({ strategy: z.literal("console"), match: matchSchema }),
  z.object({
    strategy: z.literal("tcp"),
    host: z.string().optional(),
    port: z.string().min(1),
  }),
  z.object({
    strategy: z.literal("udp_packet"),
    host: z.string().optional(),
    port: z.string().min(1),
    payload: z.string(),
    payloadEncoding: z.enum(["utf8", "hex", "base64"]),
  }),
  z.object({
    strategy: z.literal("http"),
    host: z.string().optional(),
    port: z.string().min(1),
    path: z.string().min(1),
    method: z.enum(["GET", "POST", "HEAD"]).optional(),
    expectStatus: z.number().int().min(100).max(599).optional(),
  }),
  z.object({
    strategy: z.literal("exec"),
    command: z.array(z.string()).min(1),
    expectExitCode: z.number().int().optional(),
  }),
  z.object({
    strategy: z.literal("container_exit"),
    ifNotInState: z
      .array(
        z.enum([
          "installing",
          "starting",
          "running",
          "stopping",
          "stopped",
        ])
      )
      .optional(),
  }),
])

const startingLifecycleSchema = z.object({
  probes: z.array(probeSchema).min(1),
  intervalMs: z.number().int().positive().max(60_000),
  timeoutMs: z.number().int().positive().max(30 * 60_000),
  onTimeout: z.enum(["mark_crashed", "mark_stopped", "keep_starting"]),
})

const stoppingLifecycleSchema = z.object({
  probes: z.array(probeSchema).min(1),
  graceTimeoutMs: z.number().int().positive().max(30 * 60_000),
  onTimeout: z.literal("force_kill"),
})

const crashLifecycleSchema = z.object({
  probes: z.array(probeSchema).min(1),
})

/**
 * Zod schema for blueprint lifecycle declarations. Exported because the
 * daemon validates the lifecycle block on its own when receiving a
 * `server.create_container` message.
 */
export const blueprintLifecycleSchema = z.object({
  starting: startingLifecycleSchema,
  stopping: stoppingLifecycleSchema,
  crashDetection: crashLifecycleSchema,
})

const installSchema = z.object({
  image: z.string().min(1),
  entrypoint: z.string().min(1),
  script: z.string().min(1),
})

/**
 * Zod schema for a blueprint document. Use `parseBlueprint` for the standard
 * "throw on invalid" entry point, or `.safeParse(...)` directly when you need
 * to attach validation errors to a UI form.
 */
export const blueprintSchema = z.object({
  schemaVersion: z.literal(1),
  name: localizableTextSchema,
  description: localizableTextSchema.optional(),
  author: z.string().optional(),
  dockerImages: z
    .record(z.string(), z.string().min(1))
    .refine((images) => Object.keys(images).length > 0, {
      message: "At least one docker image is required",
    }),
  stopSignal: z.string().min(1),
  startupCommand: z.string().min(1),
  configFiles: z.array(configFileSchema).optional(),
  variables: z.array(variableSchema),
  install: installSchema,
  lifecycle: blueprintLifecycleSchema,
  /**
   * Feature flags. Accepted as either a flat string list (legacy
   * Pelican-style) or a record mapping feature name → console patterns
   * the daemon watches for. List form is normalised to a record with
   * empty pattern arrays so downstream code only ever sees the record
   * shape.
   */
  features: z
    .union([z.array(z.string()), z.record(z.string(), z.array(z.string()))])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (Array.isArray(v)) {
        const out: Record<string, string[]> = {}
        for (const k of v) out[k] = []
        return out
      }
      return v
    }),
})
