import { createHash, randomUUID } from "node:crypto"

import { SignJWT, jwtVerify } from "jose"

import { pairingTokenClaimsSchema } from "@workspace/shared/jwt"
import type {
  DaemonJwtScope,
  PairingTokenClaims,
} from "@workspace/shared/jwt.types"

import type { Env } from "@/env"
import type { PairingTokenMintResult } from "@/tokens.types"

const PAIRING_TOKEN_AUD = "stellar.pairing"
const ALGORITHM = "HS256"

const secretKey = (env: Env): Uint8Array =>
  new TextEncoder().encode(env.BETTER_AUTH_SECRET)

/**
 * SHA-256 of the raw token. Stored alongside the pairing row so the database
 * never sees the plaintext.
 */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex")

/**
 * Mint a single-use pairing token bound to `nodeId`. Returns the token
 * plaintext (shown to the admin once), its hash (stored in the DB), and the
 * jti + expiry written to the pairing row.
 */
export const mintPairingToken = async (
  env: Env,
  nodeId: string
): Promise<PairingTokenMintResult> => {
  const jti = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + env.PAIRING_TOKEN_TTL_SECONDS
  const claims: PairingTokenClaims = { node: nodeId, iat: now, exp, jti }
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALGORITHM })
    .setAudience(PAIRING_TOKEN_AUD)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(secretKey(env))
  return {
    token,
    tokenHash: hashToken(token),
    jti,
    expiresAt: new Date(exp * 1_000),
  }
}

/**
 * Verify a pairing token's signature, audience, and TTL. Returns the parsed
 * claims on success; throws a generic Error on any failure (caller maps to
 * the appropriate `nodes.pair.*` envelope).
 */
export const verifyPairingToken = async (
  env: Env,
  token: string
): Promise<PairingTokenClaims> => {
  const { payload } = await jwtVerify(token, secretKey(env), {
    audience: PAIRING_TOKEN_AUD,
    algorithms: [ALGORITHM],
  })
  const parsed = pairingTokenClaimsSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error("Invalid pairing token claims")
  }
  return parsed.data
}

/**
 * Mint a daemon-bound JWT for a specific user + server + scope set, signed
 * with the per-node HMAC secret established at pair time. The browser
 * presents this directly to the daemon (console / files / SFTP password)
 * so the data path bypasses the API.
 */
export const mintDaemonToken = async (params: {
  signingKeyHex: string
  userId: string
  serverId: string
  nodeId: string
  scope: DaemonJwtScope[]
  ttlSeconds: number
}): Promise<{ token: string; expiresAt: Date }> => {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + params.ttlSeconds
  const jti = randomUUID()
  const payload = {
    sub: params.userId,
    server: params.serverId,
    node: params.nodeId,
    scope: params.scope,
    iat: now,
    exp,
    jti,
  }
  const key = Buffer.from(params.signingKeyHex, "hex")
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(new Uint8Array(key))
  return { token, expiresAt: new Date(exp * 1_000) }
}
