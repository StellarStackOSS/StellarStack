import { parseApiErrorBody } from "@workspace/shared/errors"
import type { ApiError } from "@workspace/shared/errors.types"

import { env } from "@/lib/Env"

/**
 * Error surfaced when the API returns a translation-key envelope. The raw
 * body is preserved so the UI can attach `fields[]` to form inputs.
 */
export class ApiFetchError extends Error {
  public readonly status: number
  public readonly body: ApiError

  public constructor(status: number, body: ApiError) {
    super(body.error.code)
    this.name = "ApiFetchError"
    this.status = status
    this.body = body
  }
}

/**
 * Thin authenticated `fetch` wrapper used by TanStack Query callers. JSON
 * responses are parsed; non-2xx responses with a recognisable envelope
 * throw `ApiFetchError`; everything else throws a plain `Error`.
 *
 * Once the API exports its Hono `AppType` we can swap this for the
 * `hc<AppType>` typed client; until then the contract is intentionally
 * narrow so callers don't grow type assumptions about response shapes.
 */
export const apiFetch = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const url = new URL(path, env.apiUrl)
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  if (!response.ok) {
    const parsed = parseApiErrorBody(text)
    if (parsed !== null) {
      throw new ApiFetchError(response.status, parsed)
    }
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }
  if (text.length === 0) {
    return undefined as T
  }
  return JSON.parse(text) as T
}
