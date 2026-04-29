import type { Context, ErrorHandler } from "hono"
import type { Logger } from "pino"

import { ApiException, serializeApiException } from "@workspace/shared/errors"

const getRequestId = (c: Context): string => {
  const value = c.get("requestId")
  return typeof value === "string" ? value : "unknown"
}

/**
 * Global error handler that converts thrown errors into the canonical
 * translation-key `ApiError` envelope. Known `ApiException` instances are
 * serialized verbatim; anything else surfaces as `internal.unexpected` and is
 * logged at error level so a human can investigate.
 */
export const createErrorHandler =
  (logger: Logger): ErrorHandler =>
  (err, c) => {
    const requestId = getRequestId(c)

    if (err instanceof ApiException) {
      const payload = serializeApiException(err, requestId)
      return c.json(payload.body, payload.status as never)
    }

    logger.error(
      { err, requestId, path: c.req.path },
      "Unhandled error in request"
    )
    const fallback = new ApiException("internal.unexpected", { status: 500 })
    const payload = serializeApiException(fallback, requestId)
    return c.json(payload.body, payload.status as never)
  }
