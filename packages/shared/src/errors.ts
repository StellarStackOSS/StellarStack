import { z, type ZodError } from "zod"

type ZodIssue = z.core.$ZodIssue

import type { ErrorCode } from "@workspace/shared/error-codes"
import type {
  ApiError,
  ApiErrorPayload,
  ApiFieldError,
  ErrorParams,
} from "@workspace/shared/errors.types"

const errorParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
)

const apiFieldErrorSchema = z.object({
  path: z.string(),
  code: z.string(),
  params: errorParamsSchema.optional(),
})

/**
 * Zod schema mirroring the wire-level `ApiError` envelope. Use this on the
 * client to parse non-2xx responses safely.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    params: errorParamsSchema.optional(),
    fields: z.array(apiFieldErrorSchema).optional(),
    requestId: z.string(),
  }),
})

/**
 * Thrown by API handlers to bail out with a translation-key error response.
 * Caught by the global error middleware and serialised into the `ApiError`
 * envelope.
 */
export class ApiException extends Error {
  public readonly status: number
  public readonly code: ErrorCode
  public readonly params?: ErrorParams
  public readonly fields?: ApiFieldError[]

  public constructor(
    code: ErrorCode,
    options?: {
      status?: number
      params?: ErrorParams
      fields?: ApiFieldError[]
    }
  ) {
    super(code)
    this.name = "ApiException"
    this.code = code
    this.status = options?.status ?? 400
    this.params = options?.params
    this.fields = options?.fields
  }
}

/**
 * Build a translation-keyed error response. The HTTP status defaults to 400.
 *
 * @example
 *   throw apiError("servers.create.allocation_unavailable", {
 *     params: { allocation: "1.2.3.4:25565" },
 *   })
 */
export const apiError = (
  code: ErrorCode,
  options?: {
    status?: number
    params?: ErrorParams
    fields?: ApiFieldError[]
  }
): ApiException => new ApiException(code, options)

/**
 * Convert a Zod validation failure into an `ApiException`. Each issue maps to
 * a `validation.*` translation key; consumers can attach the resulting
 * `fields[]` entries directly to form inputs.
 */
export const apiValidationError = (zodError: ZodError): ApiException => {
  const fields = zodError.issues.map(zodIssueToFieldError)
  return new ApiException("validation.failed", { status: 422, fields })
}

const stringPath = (path: ReadonlyArray<PropertyKey>): string =>
  path.map((segment) => String(segment)).join(".")

const zodIssueToFieldError = (issue: ZodIssue): ApiFieldError => {
  const path = stringPath(issue.path)
  switch (issue.code) {
    case "invalid_type":
      return {
        path,
        code: "validation.invalid_type",
        params: {
          expected: issue.expected,
          received: typeof issue.input,
        },
      }
    case "too_small":
      return {
        path,
        code:
          issue.origin === "string"
            ? "validation.string.min"
            : "validation.number.min",
        params: { min: Number(issue.minimum) },
      }
    case "too_big":
      return {
        path,
        code:
          issue.origin === "string"
            ? "validation.string.max"
            : "validation.number.max",
        params: { max: Number(issue.maximum) },
      }
    case "invalid_format":
      return {
        path,
        code: `validation.string.${issue.format}`,
      }
    case "invalid_value":
      return {
        path,
        code: "validation.enum",
        params: { received: String(issue.input) },
      }
    default:
      return { path, code: "validation.invalid" }
  }
}

/**
 * Serialise an `ApiException` into the wire envelope. Callers supply the
 * per-request id captured by request-id middleware.
 */
export const serializeApiException = (
  err: ApiException,
  requestId: string
): ApiErrorPayload => {
  const body: ApiError = {
    error: {
      code: err.code,
      requestId,
      ...(err.params !== undefined ? { params: err.params } : {}),
      ...(err.fields !== undefined ? { fields: err.fields } : {}),
    },
  }
  return { status: err.status, body }
}

/**
 * Parse a raw response body as an `ApiError` envelope. Returns `null` when
 * the body is not JSON or doesn't match the wire shape. Preferred over a
 * hand-written type guard at network boundaries — the Zod schema is the
 * single source of truth for the envelope.
 */
export const parseApiErrorBody = (responseText: string): ApiError | null => {
  let parsed: ReturnType<typeof apiErrorSchema.safeParse>
  try {
    parsed = apiErrorSchema.safeParse(JSON.parse(responseText))
  } catch {
    return null
  }
  return parsed.success ? parsed.data : null
}
