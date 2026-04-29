/**
 * Interpolation parameters embedded in an error response. Resolvers turn these
 * into locale-specific text via the matching translation key. Values must be
 * primitives — never user-facing strings.
 */
export type ErrorParams = Record<string, string | number | boolean>

/**
 * One field-level validation issue, mirrored from a Zod issue. `path` is the
 * dotted path to the offending input (`"variables.SERVER_JARFILE"`). `code`
 * is a translation key in the `validation.*` namespace.
 */
export type ApiFieldError = {
  path: string
  code: string
  params?: ErrorParams
}

/**
 * The body of every non-2xx response from the API. The frontend resolves
 * `code` and any `fields[].code` against its i18n bundle; logs and audit
 * entries store the raw codes/params verbatim.
 */
export type ApiError = {
  error: {
    code: string
    params?: ErrorParams
    fields?: ApiFieldError[]
    requestId: string
  }
}

/**
 * Server-side handle for an error in flight. Carries the HTTP status alongside
 * the wire envelope so route handlers can throw a single object.
 */
export type ApiErrorPayload = {
  status: number
  body: ApiError
}
