"use client";

import { type JSX } from "react";
import Select, {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@stellarUI/components/Select";
import { UseTheme } from "@/contexts/ThemeContext";
import { type ThemeId } from "@/lib/themes";

/**
 * Props for ThemeSelector component
 */
interface ThemeSelectorProps {
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Color preview dots component for displaying theme colors
 *
 * @param props - Preview colors array
 * @returns Color dots JSX
 */
const ColorPreview = ({
  colors,
}: {
  colors: [string, string, string];
}): JSX.Element => {
  return (
    <div className="flex gap-1">
      {colors.map((color, index) => (
        <div
          key={index}
          className="h-3 w-3 rounded-full border border-zinc-600"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

/**
 * Theme selector dropdown component
 *
 * Allows users to select from available themes with color previews.
 * Handles hydration by showing a loading placeholder until mounted.
 *
 * @component
 * @example
 * ```tsx
 * <ThemeSelector className="w-64" />
 * ```
 *
 * @param props - Component props
 * @returns Theme selector dropdown
 */
const ThemeSelector = ({ className }: ThemeSelectorProps): JSX.Element => {
  const { theme, setTheme, mounted, availableThemes } = UseTheme();

  if (!mounted) {
    return (
      <div className={className}>
        <div className="h-9 w-full animate-pulse rounded-md bg-zinc-800" />
      </div>
    );
  }

  const HandleValueChange = (value: string): void => {
    setTheme(value as ThemeId);
  };

  const currentTheme = availableThemes.find((t) => t.id === theme);

  return (
    <div className={className}>
      <Select value={theme} onValueChange={HandleValueChange}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-3">
            {currentTheme && <ColorPreview colors={currentTheme.previewColors} />}
            <SelectValue placeholder="Select theme" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableThemes.map((themeOption) => (
            <SelectItem key={themeOption.id} value={themeOption.id}>
              <div className="flex items-center gap-3">
                <ColorPreview colors={themeOption.previewColors} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{themeOption.name}</span>
                  <span className="text-xs text-zinc-500">{themeOption.description}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ThemeSelector;
