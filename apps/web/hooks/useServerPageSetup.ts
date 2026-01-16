import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface UseServerPageSetupResult {
  isDark: boolean;
  mounted: boolean;
  theme: string | undefined;
  setTheme: (theme: string) => void;
}

/**
 * Common setup hook for server pages
 * Handles hydration, theme detection, and dark mode state
 */
export const useServerPageSetup = (): UseServerPageSetupResult => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return {
    isDark,
    mounted,
    theme: resolvedTheme,
    setTheme,
  };
};
