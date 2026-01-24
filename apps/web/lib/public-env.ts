import { createPublicEnv } from "next-public-env";

export const { getPublicEnv, PublicEnv } = createPublicEnv({
  API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
});

/**
 * Get the API URL at runtime
 */
const getApiUrl = (): string => {
  const env = getPublicEnv();
  return env.API_URL;
};

/**
 * Get the base path for API requests
 */
const getApiBasePath = (): string => {
  return "/api";
};

/**
 * Get the full API endpoint URL
 */
const getApiEndpoint = (path: string): string => {
  const baseUrl = getApiUrl();
  const basePath = getApiBasePath();

  // Remove leading slash from path if present
  let cleanPath = path.startsWith("/") ? path.slice(1) : path;

  // If path already starts with "api/", don't add basePath again
  if (cleanPath.startsWith("api/")) {
    return `${baseUrl}/${cleanPath}`;
  }

  return `${baseUrl}${basePath}/${cleanPath}`;
};
