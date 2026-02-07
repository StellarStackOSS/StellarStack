import * as React from "react";
import { Command } from "./types";
import { THEMES } from "@/lib/themes";

/**
 * Creates a color preview component for theme commands
 *
 * @param colors - Array of 3 hex colors to preview
 * @returns JSX element with color dots
 */
const ThemePreview = ({ colors }: { colors: [string, string, string] }): React.JSX.Element => {
  return (
    <div className="flex items-center gap-1">
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
 * Theme commands for appearance customization
 * Each theme is a separate command for easy searching
 */
export const themeActionCommands: Command[] = THEMES.map((theme, index) => ({
  id: `theme-${theme.id}`,
  label: theme.name,
  description: theme.description,
  icon: <ThemePreview colors={theme.previewColors} />,
  category: "appearance" as const,
  type: "simple" as const,
  isAvailable: () => true,
  action: {
    onClick: async () => {
      // This will be handled specially in the CommandMenu
      // The command ID contains the theme ID to set
    },
  },
  keywords: [
    "theme",
    "appearance",
    "color",
    "style",
    theme.name.toLowerCase(),
    ...theme.id.split("-"),
  ],
  priority: 50 - index, // Order themes by their position in the array
}));
