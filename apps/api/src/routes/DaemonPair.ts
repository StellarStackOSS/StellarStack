import { Hono } from "hono"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import type { Db } from "@workspace/db/client.types"
import {
  nodePairingTokensTable,
  nodesTable,
} from "@workspace/db/schema/nodes"
import {
  ApiException,
  apiValidationError,
} from "@workspace/shared/errors"

import type { ApiVariables } from "@/middleware/RequestId"
import type { Env } from "@/env"
import { generateNodeSigningKey } from "@/routes/AdminNodes"
import { hashToken, verifyPairingToken } from "@/tokens"

const claimSchema = z.object({
  token: z.string().min(1),
})

/**
 * Daemon-facing pairing claim endpoint. Public in the sense that no
 * better-auth session is required — every request is gated by a
 * single-use, TTL-bounded pairing JWT. Successful claim:
 *
 * 1. Verifies the JWT signature, audience, and expiry.
 * 2. Looks up the matching `node_pairing_tokens` row by hash; rejects if
 *    missing, expired, or already claimed.
 * 3. Generates a fresh per-node signing secret (returned to the daemon and
 *    stored in `nodes.daemon_public_key`).
 * 4. Marks the pairing row as claimed.
 *
 * The signing secret is the only sensitive value in the response and is
 * never persisted unhashed by the daemon either — it's the symmetric key
 * the API uses to sign daemon-bound JWTs and the daemon uses to verify
 * them locally.
 */
export const buildDaemonPairRoute = (params: { db: Db; env: Env }) => {
  const { db, env } = params

  return new Hono<{ Variables: ApiVariables }>().post("/", async (c) => {
    const parsed = claimSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      throw apiValidationError(parsed.error)
    }
    const { token } = parsed.data

    let claims: Awaited<ReturnType<typeof verifyPairingToken>>
    try {
      claims = await verifyPairingToken(env, token)
    } catch {
      throw new ApiException("nodes.pair.token_invalid", { status: 401 })
    }

    const tokenHash = hashToken(token)
    const rows = await db
      .select()
      .from(nodePairingTokensTable)
      .where(
        and(
          eq(nodePairingTokensTable.tokenHash, tokenHash),
          eq(nodePairingTokensTable.nodeId, claims.node)
        )
      )
      .limit(1)
    const pairingRow = rows[0]
    if (pairingRow === undefined) {
      throw new ApiException("nodes.pair.token_invalid", { status: 401 })
    }
    if (pairingRow.claimedAt !== null) {
      throw new ApiException("nodes.pair.token_already_claimed", {
        status: 409,
      })
    }
    if (pairingRow.expiresAt.getTime() < Date.now()) {
      throw new ApiException("nodes.pair.token_expired", { status: 401 })
    }

    const signingKey = generateNodeSigningKey()
    await db.transaction(async (tx) => {
      await tx
        .update(nodesTable)
        .set({ daemonPublicKey: signingKey })
        .where(eq(nodesTable.id, claims.node))
      await tx
        .update(nodePairingTokensTable)
        .set({ claimedAt: new Date() })
        .where(
          and(
            eq(nodePairingTokensTable.id, pairingRow.id),
            isNull(nodePairingTokensTable.claimedAt)
          )
        )
    })

    const node = (
      await db
        .select()
        .from(nodesTable)
        .where(eq(nodesTable.id, claims.node))
        .limit(1)
    )[0]
    if (node === undefined) {
      throw new ApiException("nodes.not_found", { status: 404 })
    }

    return c.json({
      nodeId: node.id,
      nodeName: node.name,
      signingKey,
      websocketUrl: `${env.BETTER_AUTH_URL.replace(/^http/, "ws")}/daemon/ws`,
    })
  })
}
