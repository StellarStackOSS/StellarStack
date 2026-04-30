/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import type {
  ResolvedTheme,
  Theme,
  ThemeContextValue,
  ThemeProviderProps,
} from "@/components/ThemeProvider.types"

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = createContext<ThemeContextValue | undefined>(
  undefined
)

const isTheme = (value: string | null): value is Theme => {
  if (value === null) {
    return false
  }
  return THEME_VALUES.includes(value as Theme)
}

const getSystemTheme = (): ResolvedTheme => {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }
  return "light"
}

const disableTransitionsTemporarily = () => {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const editableParent = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  return editableParent !== null
}

/**
 * Provides theme state (light/dark/system) to descendants and applies the
 * resolved theme to the document root. Persists the user's selection in
 * `localStorage` under the configured `storageKey` and synchronises across
 * browser tabs via the `storage` event.
 *
 * Pressing `d` (when the focused element is not editable) cycles between
 * light and dark, breaking out of `system` based on the current OS preference.
 */
export const ThemeProvider = ({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  disableTransitionOnChange = true,
}: ThemeProviderProps) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    if (isTheme(storedTheme)) {
      return storedTheme
    }
    return defaultTheme
  })

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  const applyTheme = useCallback(
    (nextTheme: Theme) => {
      const root = document.documentElement
      const resolvedTheme =
        nextTheme === "system" ? getSystemTheme() : nextTheme
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove("light", "dark")
      root.classList.add(resolvedTheme)

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") {
      return undefined
    }
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      applyTheme("system")
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])


  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }
      if (event.key !== storageKey) {
        return
      }
      if (isTheme(event.newValue)) {
        setThemeState(event.newValue)
        return
      }
      setThemeState(defaultTheme)
    }
    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme }),
    [theme, setTheme]
  )

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/**
 * Returns the current theme and a setter. Must be called from within a
 * `ThemeProvider`; throws otherwise.
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
