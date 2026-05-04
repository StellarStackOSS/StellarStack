import { randomBytes, randomUUID, createHash } from "node:crypto"

import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  nodeAllocationsTable,
  nodePairingTokensTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { Auth } from "@/auth"
import type { AuthVariables } from "@/middleware/RequireSession"
import { buildRequireAdmin } from "@/middleware/RequireAdmin"

const createNodeSchema = z.object({
  name: z.string().min(1).max(120),
  fqdn: z.string().min(1),
  scheme: z.enum(["http", "https"]),
  daemonPort: z.number().int().min(1).max(65535),
  sftpPort: z.number().int().min(1).max(65535),
  memoryTotalMb: z.number().int().positive(),
  diskTotalMb: z.number().int().positive(),
})

const allocationsSchema = z
  .object({
    ip: z.string().min(1),
    ports: z.array(z.number().int().min(1).max(65535)).optional(),
    portRange: z
      .object({
        start: z.number().int().min(1).max(65535),
        end: z.number().int().min(1).max(65535),
      })
      .optional(),
    alias: z.string().max(120).optional(),
  })
  .refine(
    (v) => v.ports !== undefined || v.portRange !== undefined,
    "ports or portRange required"
  )

const PAIRING_TTL_SECONDS = 600

/**
 * Hashing scheme for pairing tokens: we store SHA-256(token) so a leaked
 * DB doesn't expose the original token. The daemon presents the token
 * verbatim and we hash to verify.
 */
const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex")

export const buildNodesRoute = (params: { auth: Auth; db: Db }) => {
  const { auth, db } = params
  const adminMiddleware = buildRequireAdmin(auth)

  return new Hono<{ Variables: AuthVariables }>()
    .use("*", ...adminMiddleware)
    .get("/", async (c) => {
      const rows = await db.select().from(nodesTable)
      return c.json({ nodes: rows })
    })
    .post("/", async (c) => {
      const parsed = createNodeSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const [row] = await db
        .insert(nodesTable)
        .values({ ...parsed.data, daemonPublicKey: null })
        .returning()
      if (row === undefined) {
        throw new ApiException("internal.unexpected", { status: 500 })
      }
      return c.json({ node: row })
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const node = (
        await db.select().from(nodesTable).where(eq(nodesTable.id, id)).limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      const allocations = await db
        .select()
        .from(nodeAllocationsTable)
        .where(eq(nodeAllocationsTable.nodeId, id))
      return c.json({ node, allocations })
    })
    .put("/:id", async (c) => {
      const id = c.req.param("id")
      const parsed = createNodeSchema.partial().safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const [row] = await db
        .update(nodesTable)
        .set(parsed.data)
        .where(eq(nodesTable.id, id))
        .returning()
      if (row === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      return c.json({ node: row })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      try {
        await db.delete(nodesTable).where(eq(nodesTable.id, id))
      } catch {
        throw new ApiException("nodes.has_servers", { status: 409 })
      }
      return c.json({ ok: true })
    })
    .get("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const allocations = await db
        .select()
        .from(nodeAllocationsTable)
        .where(eq(nodeAllocationsTable.nodeId, id))
      return c.json({ allocations })
    })
    .post("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const parsed = allocationsSchema.safeParse(await c.req.json())
      if (!parsed.success) throw apiValidationError(parsed.error)
      const ports: number[] =
        parsed.data.ports !== undefined
          ? parsed.data.ports
          : (() => {
              const range = parsed.data.portRange
              if (range === undefined) return []
              const lo = Math.min(range.start, range.end)
              const hi = Math.max(range.start, range.end)
              const out: number[] = []
              for (let p = lo; p <= hi; p++) out.push(p)
              return out
            })()
      const rows = ports.map((port) => ({
        id: randomUUID(),
        nodeId: id,
        ip: parsed.data.ip,
        port,
        alias: parsed.data.alias ?? null,
        serverId: null,
      }))
      const inserted = await db
        .insert(nodeAllocationsTable)
        .values(rows)
        .onConflictDoNothing()
        .returning()
      return c.json({ created: inserted.length, allocations: inserted })
    })
    .delete("/:id/allocations/:allocId", async (c) => {
      const allocId = c.req.param("allocId")
      const row = (
        await db
          .select({ serverId: nodeAllocationsTable.serverId })
          .from(nodeAllocationsTable)
          .where(eq(nodeAllocationsTable.id, allocId))
          .limit(1)
      )[0]
      if (row !== undefined && row.serverId !== null) {
        throw new ApiException("servers.action.invalid_state", { status: 409 })
      }
      await db
        .delete(nodeAllocationsTable)
        .where(eq(nodeAllocationsTable.id, allocId))
      return c.json({ ok: true })
    })
    .post("/:id/pair", async (c) => {
      const id = c.req.param("id")
      const node = (
        await db.select().from(nodesTable).where(eq(nodesTable.id, id)).limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      // Generate the raw token: it carries the node id so a daemon can
      // present it without knowing its own uuid yet.
      const raw = `${id}.${randomBytes(32).toString("base64url")}`
      const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000)
      await db.insert(nodePairingTokensTable).values({
        nodeId: id,
        tokenHash: hashToken(raw),
        expiresAt,
      })
      return c.json({ token: raw, expiresAt: expiresAt.toISOString() })
    })
}

/**
 * Public (daemon-facing, unauthenticated) pairing endpoint. Mounted
 * separately so admin auth middleware doesn't apply.
 */
export const buildPairingExchangeRoute = (params: { db: Db }) => {
  const { db } = params
  const exchangeSchema = z.object({ token: z.string().min(1) })
  return new Hono().post("/exchange", async (c) => {
    const parsed = exchangeSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      throw new ApiException("nodes.pair.token_invalid", { status: 400 })
    }
    const token = parsed.data.token
    const dotIdx = token.indexOf(".")
    if (dotIdx <= 0) {
      throw new ApiException("nodes.pair.token_invalid", { status: 400 })
    }
    const nodeId = token.slice(0, dotIdx)
    const hash = hashToken(token)
    const record = (
      await db
        .select()
        .from(nodePairingTokensTable)
        .where(eq(nodePairingTokensTable.tokenHash, hash))
        .limit(1)
    )[0]
    if (record === undefined || record.nodeId !== nodeId) {
      throw new ApiException("nodes.pair.token_invalid", { status: 400 })
    }
    if (record.claimedAt !== null) {
      throw new ApiException("nodes.pair.token_already_claimed", { status: 409 })
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new ApiException("nodes.pair.token_expired", { status: 410 })
    }
    // Mint a fresh signing key for this node, persist it, mark token used.
    const signingKey = randomBytes(32).toString("hex")
    await db.transaction(async (tx) => {
      await tx
        .update(nodesTable)
        .set({ daemonPublicKey: signingKey })
        .where(eq(nodesTable.id, nodeId))
      await tx
        .update(nodePairingTokensTable)
        .set({ claimedAt: new Date() })
        .where(eq(nodePairingTokensTable.id, record.id))
    })
    return c.json({ nodeId, signingKey })
  })
}
