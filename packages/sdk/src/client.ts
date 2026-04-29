import { z } from "zod"

import { parseApiErrorBody } from "@workspace/shared/errors"

import {
  ApiClientError,
  type ApiClientOptions,
} from "@workspace/sdk/client.types"

/**
 * Minimal SDK surface in the foundation milestone. This grows alongside the
 * API; once `apps/api` exports its Hono `AppType`, swap the calls below for
 * a typed `hc<AppType>` client (which removes the need for response-shape
 * Zod schemas — the type comes from the server's route definitions).
 */
export type ApiClient = {
  health: () => Promise<HealthResponse>
}

const healthResponseSchema = z.object({ status: z.literal("ok") })

/**
 * Response shape returned by `GET /health`.
 */
export type HealthResponse = z.infer<typeof healthResponseSchema>

const buildHeaders = (
  base: HeadersInit | undefined,
  token: string | null
): Headers => {
  const headers = new Headers(base ?? {})
  headers.set("Accept", "application/json")
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (token !== null && token !== "") {
    headers.set("Authorization", `Bearer ${token}`)
  }
  return headers
}

/**
 * Construct an API client bound to the given `baseUrl`. Non-2xx responses
 * with a translation-key envelope are surfaced as typed `ApiClientError`
 * instances; transport failures throw the underlying network error.
 */
export const createApiClient = (options: ApiClientOptions): ApiClient => {
  const fetchImpl = options.fetchImpl ?? fetch
  const getToken = options.getToken ?? (() => null)

  const handleErrorResponse = async (
    response: Response,
    path: string
  ): Promise<never> => {
    const body = await response.text()
    const parsed = parseApiErrorBody(body)
    if (parsed !== null) {
      throw new ApiClientError(response.status, parsed)
    }
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }

  return {
    health: async () => {
      const url = new URL("/health", options.baseUrl)
      const response = await fetchImpl(url, {
        headers: buildHeaders(undefined, getToken()),
      })
      if (!response.ok) {
        await handleErrorResponse(response, "/health")
      }
      const parsed = healthResponseSchema.safeParse(await response.json())
      if (!parsed.success) {
        throw new Error("Health response did not match expected shape")
      }
      return parsed.data
    },
  }
}
