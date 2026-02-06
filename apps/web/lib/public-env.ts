import { createPublicEnv } from "next-public-env";

/** Whether the app is running inside the Tauri desktop shell. */
const IS_DESKTOP = process.env.NEXT_PUBLIC_DESKTOP_MODE === "true";

export const { getPublicEnv, PublicEnv: _PublicEnv } = createPublicEnv({
  API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
});

/**
 * PublicEnv component — renders nothing in desktop mode since the API URL
 * is baked in at build time. In normal web deployments the runtime script
 * tag is rendered as usual.
 */
export const PublicEnv = IS_DESKTOP
  ? () => null
  : _PublicEnv;

/**
 * Get the API URL at runtime.
 * Desktop mode returns a hardcoded localhost URL.
 */
export const getApiUrl = (): string => {
  if (IS_DESKTOP) {
    return "http://localhost:3001";
  }
  const env = getPublicEnv();
  return env.API_URL;
};

/**
 * Get the base path for API requests
 */
export const getApiBasePath = (): string => {
  return "/api";
};

/**
 * Get the full API endpoint URL
 */
export const getApiEndpoint = (path: string): string => {
  const baseUrl = getApiUrl();
  const basePath = getApiBasePath();

  // Remove leading slash from path if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  // If path already starts with "api/", don't add basePath again
  if (cleanPath.startsWith("api/")) {
    return `${baseUrl}/${cleanPath}`;
  }

  return `${baseUrl}${basePath}/${cleanPath}`;
};
