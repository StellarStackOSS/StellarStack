import { createHmac, randomBytes } from "node:crypto"

import type {
  DaemonJwtClaims,
  DaemonJwtScope,
} from "@workspace/shared/jwt.types"

const base64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/**
 * Mint an HS256 JWT for browser → daemon access. Signed with the per-node
 * HMAC key so a compromised node can't forge tokens for another node.
 *
 * The claims layout matches `@workspace/shared/jwt.types.DaemonJwtClaims`
 * — the daemon's verifier validates this exact shape.
 */
export const mintDaemonToken = (params: {
  signingKeyHex: string
  userId: string
  serverId: string
  nodeId: string
  scope: DaemonJwtScope[]
  ttlSeconds: number
}): { token: string; expiresAt: Date } => {
  const now = Math.floor(Date.now() / 1000)
  const claims: DaemonJwtClaims = {
    sub: params.userId,
    server: params.serverId,
    node: params.nodeId,
    scope: params.scope,
    iat: now,
    exp: now + params.ttlSeconds,
    jti: randomBytes(8).toString("hex"),
  }
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })))
  const payload = base64url(Buffer.from(JSON.stringify(claims)))
  const signingInput = `${header}.${payload}`
  const sig = base64url(
    createHmac("sha256", Buffer.from(params.signingKeyHex, "hex"))
      .update(signingInput)
      .digest()
  )
  return {
    token: `${signingInput}.${sig}`,
    expiresAt: new Date(claims.exp * 1000),
  }
}
