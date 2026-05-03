import { createHmac } from "node:crypto"

/**
 * Sign and dispatch an HTTP request to a daemon's remote control surface.
 * The daemon verifies the request with the same per-node signing key
 * stored in `nodes.daemon_public_key`, so a leaked daemon URL can't be
 * called from anywhere but a process that holds the key.
 */
export const callDaemon = async (params: {
  baseUrl: string
  nodeId: string
  signingKeyHex: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  body?: unknown
  signal?: AbortSignal
}): Promise<Response> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = createHmac("sha256", Buffer.from(params.signingKeyHex, "hex"))
    .update(`${params.nodeId}|${ts}`)
    .digest("hex")
  const headers: Record<string, string> = {
    "X-Stellar-Node-Id": params.nodeId,
    "X-Stellar-Timestamp": ts,
    Authorization: `Bearer ${sig}`,
  }
  const init: RequestInit = {
    method: params.method,
    headers,
    signal: params.signal,
  }
  if (params.body !== undefined) {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(params.body)
  }
  return fetch(`${params.baseUrl.replace(/\/$/, "")}${params.path}`, init)
}
