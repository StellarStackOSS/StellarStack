/**
 * Browser-side runtime configuration. Reads from Vite's `import.meta.env`
 * (each `VITE_*` value is statically inlined at build time). All consumers
 * import this object rather than touching `import.meta.env` directly so
 * defaults live in one place.
 */
const sameOrigin =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

type DesktopBridge = { apiUrl?: string; wsUrl?: string }
const desktop: DesktopBridge | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as { stellar?: DesktopBridge }).stellar)
    : undefined

const apiUrl = desktop?.apiUrl ?? import.meta.env.VITE_API_URL ?? sameOrigin

export const env = {
  apiUrl,
  wsUrl: desktop?.wsUrl ?? import.meta.env.VITE_WS_URL ?? apiUrl.replace(/^http/, "ws"),
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE ?? "en",
} as const

/**
 * Compile-time-known environment shape; exported as a type so consumers can
 * destructure without re-deriving it.
 */
export type WebEnv = typeof env
