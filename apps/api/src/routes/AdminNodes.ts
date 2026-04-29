import { randomBytes } from "node:crypto"

import { Hono } from "hono"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  nodeAllocationsTable,
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

const createAllocationsSchema = z.object({
  ip: z.string().min(1).max(64),
  ports: z
    .array(z.number().int().min(1).max(65535))
    .min(1)
    .max(2048)
    .optional(),
  portRange: z
    .object({
      start: z.number().int().min(1).max(65535),
      end: z.number().int().min(1).max(65535),
    })
    .optional(),
  alias: z.string().max(64).optional(),
})

const expandPorts = (
  body: z.infer<typeof createAllocationsSchema>
): number[] => {
  if (body.ports !== undefined && body.ports.length > 0) {
    return Array.from(new Set(body.ports))
  }
  if (body.portRange !== undefined) {
    const { start, end } = body.portRange
    if (end < start) {
      return []
    }
    const out: number[] = []
    for (let p = start; p <= end; p += 1) {
      out.push(p)
    }
    return out
  }
  return []
}

/**
 * Admin-only node CRUD + allocation management + pairing-token mint.
 * Mounted under `/admin/nodes` from the admin route group so the
 * requireAdmin middleware applies uniformly.
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
    .get("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const rows = await db
        .select()
        .from(nodeAllocationsTable)
        .where(eq(nodeAllocationsTable.nodeId, id))
        .orderBy(
          asc(nodeAllocationsTable.ip),
          asc(nodeAllocationsTable.port)
        )
      return c.json({ allocations: rows })
    })
    .post("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const parsed = createAllocationsSchema.safeParse(await c.req.json())
      if (!parsed.success) {
        throw apiValidationError(parsed.error)
      }
      const node = (
        await db
          .select({ id: nodesTable.id })
          .from(nodesTable)
          .where(eq(nodesTable.id, id))
          .limit(1)
      )[0]
      if (node === undefined) {
        throw new ApiException("nodes.not_found", { status: 404 })
      }
      const ports = expandPorts(parsed.data)
      if (ports.length === 0) {
        throw apiValidationError(
          new z.ZodError([
            {
              code: "custom",
              path: ["ports"],
              message: "Provide either `ports` or a `portRange` with end >= start",
              input: parsed.data,
            },
          ])
        )
      }
      const inserted = await db
        .insert(nodeAllocationsTable)
        .values(
          ports.map((port) => ({
            nodeId: id,
            ip: parsed.data.ip,
            port,
            alias: parsed.data.alias ?? null,
          }))
        )
        .onConflictDoNothing({
          target: [
            nodeAllocationsTable.nodeId,
            nodeAllocationsTable.ip,
            nodeAllocationsTable.port,
          ],
        })
        .returning()
      return c.json(
        { created: inserted.length, allocations: inserted },
        201
      )
    })
    .delete("/:id/allocations", async (c) => {
      const id = c.req.param("id")
      const idsParam = c.req.query("ids")
      const idList = (idsParam ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      if (idList.length === 0) {
        throw apiValidationError(
          new z.ZodError([
            {
              code: "custom",
              path: ["ids"],
              message: "Provide at least one allocation id via ?ids=…",
              input: idsParam,
            },
          ])
        )
      }
      const deleted = await db
        .delete(nodeAllocationsTable)
        .where(
          and(
            eq(nodeAllocationsTable.nodeId, id),
            inArray(nodeAllocationsTable.id, idList),
            isNull(nodeAllocationsTable.serverId)
          )
        )
        .returning({ id: nodeAllocationsTable.id })
      return c.json({ deleted: deleted.length })
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
