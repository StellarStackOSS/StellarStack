import { ditherAvatarDataUri } from "dither-avatar"

/**
 * Default avatar for a given seed (user name / email). Returns a
 * deterministic dithered SVG inlined as a data URI — no external
 * service, no network request. Same seed → same avatar.
 *
 * Kept under the legacy `dicebearAvatarUrl` name so existing call sites
 * don't churn; the underlying implementation now uses `dither-avatar`.
 */
export const dicebearAvatarUrl = (seed: string): string =>
  ditherAvatarDataUri((seed.trim() === "" ? "user" : seed.trim()))
