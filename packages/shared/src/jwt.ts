import { z } from "zod"

const daemonJwtScopeSchema = z.enum([
  "console.read",
  "console.write",
  "stats.read",
  "files.read",
  "files.write",
  "files.delete",
  "sftp",
  "backup.read",
  "backup.write",
  "transfer.source",
  "transfer.target",
])

/**
 * Zod schema for daemon-bound JWT claims. Used by daemon validators and by
 * tests that round-trip token payloads.
 */
export const daemonJwtClaimsSchema = z.object({
  sub: z.string().min(1),
  server: z.string().min(1),
  node: z.string().min(1),
  scope: z.array(daemonJwtScopeSchema).min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().min(1),
})

/**
 * Zod schema for node-pairing tokens.
 */
export const pairingTokenClaimsSchema = z.object({
  node: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().min(1),
})

/**
 * Zod schema for one-time daemon-to-daemon transfer tokens.
 */
export const transferTokenClaimsSchema = z.object({
  sourceServer: z.string().min(1),
  targetServer: z.string().min(1),
  sourceNode: z.string().min(1),
  targetNode: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().min(1),
})

export const daemonJwtScopes = daemonJwtScopeSchema.options
