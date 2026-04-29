import type { Context } from "hono"
import type { Logger } from "pino"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import { ApiException, serializeApiException } from "@workspace/shared/errors"

import type { ApiVariables } from "@/middleware/RequestId"

type ApiContext = Context<{ Variables: ApiVariables }>

/**
 * Global error handler that converts thrown errors into the canonical
 * translation-key `ApiError` envelope. Known `ApiException` instances are
 * serialized verbatim; anything else surfaces as `internal.unexpected` and is
 * logged at error level so a human can investigate.
 */
export const createErrorHandler =
  (logger: Logger) =>
  (err: Error, c: ApiContext) => {
    const requestId = c.get("requestId")

    if (err instanceof ApiException) {
      const payload = serializeApiException(err, requestId)
      return c.json(payload.body, payload.status as ContentfulStatusCode)
    }

    logger.error(
      { err, requestId, path: c.req.path },
      "Unhandled error in request"
    )
    const fallback = new ApiException("internal.unexpected", { status: 500 })
    const payload = serializeApiException(fallback, requestId)
    return c.json(payload.body, payload.status as ContentfulStatusCode)
  }
