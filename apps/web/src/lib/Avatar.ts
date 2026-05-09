/**
 * URL of the dicebear notionists-neutral avatar for a given seed. Used as
 * the default avatar when a user hasn't supplied a custom image. Stable
 * for a given seed string, so the same name always renders the same mark.
 */
export const dicebearAvatarUrl = (seed: string): string =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(seed.trim() || "user")}`
