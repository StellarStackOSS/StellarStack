import { randomBytes } from "node:crypto"

import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  nodePairingTokensTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import { ApiException, apiValidationError } from "@workspace/shared/errors"

import type { AuthVariables } from "@/middleware/RequireSession"
import type { Env } from "@/env"
import { mintPairingToken } from "@/tokens"

const createNodeSchema = z.object({
  name: z.string().min(1).max(64),
  fqdn: z.string().min(1).max(255),
  scheme: z.enum(["http", "https"]),
  daemonPort: z.number().int().min(1).max(65535),
  sftpPort: z.number().int().min(1).max(65535),
  memoryTotalMb: z.number().int().nonnegative(),
  diskTotalMb: z.number().int().nonnegative(),
})

/**
 * Admin-only node CRUD plus the pairing-token mint endpoint. Mounted under
 * `/admin/nodes` from the admin route group so the requireAdmin middleware
 * applies uniformly.
 */
export const buildAdminNodesRoute = (params: { db: Db; env: Env }) => {
  const { db, env } = params

  return new Hono<{ Variables: AuthVariables }>()
    .get("/", async (c) => {
      const rows = await db.select().from(nodesTable)
      return c.json({ nodes: rows })
    })
    .post("/", async (c) => {
      const parsed = createNodeSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const inserted = await db
        .insert(nodesTable)
        .values(parsed.data)
        .returning()
      const row = inserted[0]
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      return c.json({ node: row }, 201)
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const rows = await db
        .select()
        .from(nodesTable)
        .where(eq(nodesTable.id, id))
        .limit(1)
      const row = rows[0]
      if (row === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      return c.json({ node: row })
    })
    .post("/:id/pairing-tokens", async (c) => {
      const id = c.req.param("id")
      const exists = await db
        .select({ id: nodesTable.id })
        .from(nodesTable)
        .where(eq(nodesTable.id, id))
        .limit(1)
      if (exists[0] === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      const minted = await mintPairingToken(env, id)
      await db.insert(nodePairingTokensTable).values({
        nodeId: id,
        tokenHash: minted.tokenHash,
        expiresAt: minted.expiresAt,
      })
      return c.json(
        {
          token: minted.token,
          expiresAt: minted.expiresAt.toISOString(),
        },
        201
      )
    })
}

/**
 * Generate a fresh per-node HMAC signing secret. Stored alongside the node
 * row at pair-time and used to sign every daemon-bound JWT (browser console
 * tokens, SFTP passwords, transfer tokens).
 */
export const generateNodeSigningKey = (): string =>
  randomBytes(32).toString("hex")
