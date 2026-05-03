import { ApiException } from "@workspace/shared/errors"

import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

/**
 * Convert any caught error into the canonical `{error:{code, params}}`
 * envelope. Mirrors the previous design's contract so the web side's
 * translateApiError keeps working.
 */
export const errorToResponse = (
  c: Context,
  err: unknown
): Response => {
  if (err instanceof ApiException) {
    return c.json(
      { error: { code: err.code, params: err.params ?? undefined } },
      err.status as ContentfulStatusCode
    )
  }
  console.error("api error:", err)
  return c.json({ error: { code: "internal.unexpected" } }, 500)
}
