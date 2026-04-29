/**
 * Browser-side runtime configuration. Reads from Vite's `import.meta.env`
 * (each `VITE_*` value is statically inlined at build time). All consumers
 * import this object rather than touching `import.meta.env` directly so
 * defaults live in one place.
 */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  wsUrl:
    import.meta.env.VITE_WS_URL ??
    (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(
      /^http/,
      "ws"
    ),
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE ?? "en",
} as const

/**
 * Compile-time-known environment shape; exported as a type so consumers can
 * destructure without re-deriving it.
 */
export type WebEnv = typeof env
