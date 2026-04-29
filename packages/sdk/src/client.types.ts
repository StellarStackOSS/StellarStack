import type { ApiError } from "@workspace/shared/errors.types"

/**
 * Configuration for `createApiClient`.
 */
export type ApiClientOptions = {
  /** Absolute base URL of the api service, e.g. `https://api.stellarstack.dev`. */
  baseUrl: string
  /** Bearer token attached to every request. Refreshed by the caller. */
  getToken?: () => string | null
  /** Optional `fetch` implementation override (testing, server-side use). */
  fetchImpl?: typeof fetch
}

/**
 * Error surfaced by the SDK when the API returns a non-2xx response and the
 * body matches the `ApiError` envelope.
 */
export class ApiClientError extends Error {
  public readonly status: number
  public readonly body: ApiError

  public constructor(status: number, body: ApiError) {
    super(body.error.code)
    this.name = "ApiClientError"
    this.status = status
    this.body = body
  }
}
