/**
 * Theme definitions for StellarStack multi-theme support
 */

/**
 * Available theme identifiers
 */
export type ThemeId =
  | "default"
  | "system"
  | "tokyonight"
  | "everforest"
  | "ayu"
  | "catppuccin"
  | "catppuccin-macchiato"
  | "gruvbox"
  | "kanagawa"
  | "nord"
  | "matrix"
  | "one-dark";

/**
 * Theme metadata for UI display
 */
interface ThemeMetadata {
  /** Unique identifier for the theme */
  id: ThemeId;
  /** Display name for the theme */
  name: string;
  /** Short description of the theme */
  description: string;
  /** Preview colors for theme selector (background, primary, accent) */
  previewColors: [string, string, string];
}

/**
 * localStorage key for persisting theme preference
 */
export const THEME_STORAGE_KEY = "stellarstack-theme";

/**
 * Default theme when no preference is set
 */
export const DEFAULT_THEME: ThemeId = "default";

/**
 * Array of all available themes with metadata
 */
export const THEMES: ThemeMetadata[] = [
  {
    id: "default",
    name: "Default",
    description: "StellarStack default dark theme",
    previewColors: ["#1a1a1a", "#ffffff", "#3b82f6"],
  },
  {
    id: "system",
    name: "System",
    description: "Follows your system preference",
    previewColors: ["#1a1a1a", "#ffffff", "#6366f1"],
  },
  {
    id: "tokyonight",
    name: "Tokyo Night",
    description: "A clean dark theme inspired by Tokyo nights",
    previewColors: ["#1a1b26", "#c0caf5", "#7aa2f7"],
  },
  {
    id: "everforest",
    name: "Everforest",
    description: "A green-based comfortable dark theme",
    previewColors: ["#2d353b", "#d3c6aa", "#a7c080"],
  },
  {
    id: "ayu",
    name: "Ayu",
    description: "Modern dark theme with warm accents",
    previewColors: ["#0d1017", "#bfbdb6", "#ffb454"],
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    description: "Soothing pastel theme - Mocha variant",
    previewColors: ["#1e1e2e", "#cdd6f4", "#cba6f7"],
  },
  {
    id: "catppuccin-macchiato",
    name: "Catppuccin Macchiato",
    description: "Soothing pastel theme - Macchiato variant",
    previewColors: ["#24273a", "#cad3f5", "#c6a0f6"],
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    description: "Retro groove dark theme",
    previewColors: ["#282828", "#ebdbb2", "#fe8019"],
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    description: "Dark theme inspired by Japanese art",
    previewColors: ["#1f1f28", "#dcd7ba", "#7e9cd8"],
  },
  {
    id: "nord",
    name: "Nord",
    description: "Arctic, north-bluish color palette",
    previewColors: ["#2e3440", "#eceff4", "#88c0d0"],
  },
  {
    id: "matrix",
    name: "Matrix",
    description: "Green on black hacker aesthetic",
    previewColors: ["#0d0d0d", "#00ff00", "#003300"],
  },
  {
    id: "one-dark",
    name: "One Dark",
    description: "Atom One Dark theme",
    previewColors: ["#282c34", "#abb2bf", "#61afef"],
  },
];

/**
 * Get theme metadata by ID
 *
 * @param id - The theme identifier
 * @returns Theme metadata or undefined if not found
 */
export const GetThemeById = (id: ThemeId): ThemeMetadata | undefined => {
  return THEMES.find((theme) => theme.id === id);
};

export default THEMES;
