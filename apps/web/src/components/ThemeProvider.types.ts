import type { ReactNode } from "react"

/**
 * The user's preferred theme selection. `system` defers to the OS-level
 * `prefers-color-scheme` media query.
 */
export type Theme = "dark" | "light" | "system"

/**
 * The actual theme applied to the document after resolving `system`.
 */
export type ResolvedTheme = "dark" | "light"

/**
 * Props accepted by `ThemeProvider`.
 */
export type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

/**
 * Value exposed by the `useTheme` hook.
 */
export type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}
