import type { TFunction } from "i18next"

import type { ApiError } from "@workspace/shared/errors.types"

/**
 * Translate an API error envelope into a human-readable string using i18next.
 * Looks up `error.code` in the `errors` namespace first, then falls back to
 * the raw code (so an unrecognised key surfaces verbatim instead of
 * disappearing). Field-level errors are not joined here — the form layer
 * attaches each `field.code` directly to its input.
 */
export const translateApiError = (
  t: TFunction,
  error: ApiError["error"]
): string => {
  return t(error.code, {
    ns: "errors",
    defaultValue: error.code,
    ...(error.params ?? {}),
  })
}
