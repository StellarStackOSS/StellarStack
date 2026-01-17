import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface UseAccountThemeResult {
  mounted: boolean;
  theme: string | undefined;
  setTheme: (theme: string) => void;
}

/**
 * Hook for account pages to handle theme detection and state
 * Ensures mounted state before reading resolvedTheme to avoid hydration mismatch
 */
export const useAccountTheme = (): UseAccountThemeResult => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    mounted,
    theme: resolvedTheme,
    setTheme,
  };
};
