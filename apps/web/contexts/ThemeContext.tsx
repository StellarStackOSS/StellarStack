"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

/**
 * Theme context value interface
 */
interface ThemeContextValue {
  /** Current theme ID */
  theme: ThemeId;
  /** Function to change the theme */
  setTheme: (theme: ThemeId) => void;
  /** Whether the component has mounted (for hydration safety) */
  mounted: boolean;
  /** Array of available themes */
  availableThemes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  mounted: false,
  availableThemes: THEMES,
});

/**
 * Props for the ThemeProvider component
 */
interface ThemeProviderProps {
  /** Child components to wrap */
  children: React.ReactNode;
}

/**
 * Theme provider component that manages theme state and applies theme classes
 *
 * @param props - Provider props
 * @returns Theme provider with children
 */
const ThemeProvider = ({ children }: ThemeProviderProps): React.JSX.Element => {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  /**
   * Applies the theme class to the document body
   */
  const ApplyThemeClass = useCallback((themeId: ThemeId): void => {
    const root = document.documentElement;

    THEMES.forEach((t) => {
      if (t.id !== "default" && t.id !== "system") {
        root.classList.remove(`theme-${t.id}`);
      }
    });

    if (themeId !== "default" && themeId !== "system") {
      root.classList.add(`theme-${themeId}`);
    }
  }, []);

  /**
   * Sets the theme and persists to localStorage
   */
  const SetTheme = useCallback(
    (newTheme: ThemeId): void => {
      setThemeState(newTheme);
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      ApplyThemeClass(newTheme);
    },
    [ApplyThemeClass]
  );

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    const validTheme =
      storedTheme && THEMES.some((t) => t.id === storedTheme) ? storedTheme : DEFAULT_THEME;

    setThemeState(validTheme);
    ApplyThemeClass(validTheme);
    setMounted(true);
  }, [ApplyThemeClass]);

  const contextValue: ThemeContextValue = {
    theme,
    setTheme: SetTheme,
    mounted,
    availableThemes: THEMES,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 *
 * @returns Theme context value with theme, setTheme, mounted, and availableThemes
 */
const UseTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  return context;
};

export { ThemeProvider, UseTheme, ThemeContext };
export default ThemeProvider;
