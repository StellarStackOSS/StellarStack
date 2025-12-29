/**
 * Security middleware for Hono
 *
 * Adds security headers and validates requests
 */

import type { Context, Next } from "hono";

/**
 * Security headers middleware
 * Adds common security headers to all responses
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Prevent clickjacking
    c.header("X-Frame-Options", "DENY");

    // Prevent MIME type sniffing
    c.header("X-Content-Type-Options", "nosniff");

    // Enable XSS filter in older browsers
    c.header("X-XSS-Protection", "1; mode=block");

    // Referrer policy
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions policy (restrict browser features)
    c.header(
      "Permissions-Policy",
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
    );

    // Content Security Policy for API responses
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'"
    );

    // Strict Transport Security (for HTTPS)
    if (process.env.NODE_ENV === "production") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  };
}

/**
 * Validate required environment variables at startup
 * Throws if critical security variables are missing in production
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];

  // Critical variables that must be set
  const criticalVars = [
    "BETTER_AUTH_SECRET",
    "DATABASE_URL",
  ];

  // Variables that must be set in production
  const productionVars = [
    "FRONTEND_URL",
    "API_URL",
    "DOWNLOAD_TOKEN_SECRET",
    "ENCRYPTION_KEY",
  ];

  for (const envVar of criticalVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing critical environment variable: ${envVar}`);
    }
  }

  if (isProduction) {
    for (const envVar of productionVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing production environment variable: ${envVar}`);
      }
    }

    // Check for insecure defaults
    if (process.env.FRONTEND_URL === "http://localhost:3000") {
      errors.push("FRONTEND_URL should not be localhost in production");
    }

    if (process.env.API_URL === "http://localhost:4000") {
      errors.push("API_URL should not be localhost in production");
    }
  }

  // Warn about optional but recommended variables
  const warnings: string[] = [];

  if (!process.env.ENCRYPTION_KEY) {
    warnings.push("ENCRYPTION_KEY not set - AES encryption will be unavailable");
  }

  if (!process.env.DOWNLOAD_TOKEN_SECRET) {
    warnings.push("DOWNLOAD_TOKEN_SECRET not set - using BETTER_AUTH_SECRET as fallback");
  }

  // Log warnings
  for (const warning of warnings) {
    console.warn(`[Security Warning] ${warning}`);
  }

  // Throw errors in production, warn in development
  if (errors.length > 0) {
    const message = `Security configuration errors:\n${errors.join("\n")}`;
    if (isProduction) {
      throw new Error(message);
    } else {
      console.error(`[Security Error] ${message}`);
    }
  }
}

/**
 * Get a required environment variable
 * Throws if not set in production, returns fallback in development
 */
export function getRequiredEnv(name: string, fallback?: string): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (fallback !== undefined && process.env.NODE_ENV !== "production") {
    console.warn(`[Security] Using fallback for ${name} in development mode`);
    return fallback;
  }

  throw new Error(`Required environment variable ${name} is not set`);
}

/**
 * Validate that a URL is safe for SSRF protection
 * Blocks internal IPs and localhost
 */
export function validateExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Block localhost
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "0.0.0.0"
    ) {
      return false;
    }

    // Block private IP ranges
    const ip = parsed.hostname;
    if (isPrivateIP(ip)) {
      return false;
    }

    // Block internal protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an IP address is in a private range
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,                      // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,                // 192.168.0.0/16
    /^169\.254\./,                // 169.254.0.0/16 (link-local)
    /^127\./,                     // 127.0.0.0/8 (loopback)
  ];

  for (const range of privateRanges) {
    if (range.test(ip)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate daemon node configuration for SSRF protection
 * Returns sanitized node info or throws
 */
export function validateNodeConfig(node: {
  host: string;
  port: number;
  protocol: string;
}): void {
  // Check for private IPs (potential SSRF)
  if (isPrivateIP(node.host) && process.env.NODE_ENV === "production") {
    // In production, we might still need to connect to private IPs
    // but we should log this for audit
    console.warn(`[Security Audit] Daemon connection to private IP: ${node.host}`);
  }

  // Validate port range
  if (node.port < 1 || node.port > 65535) {
    throw new Error("Invalid daemon port");
  }

  // Validate protocol
  if (!["HTTP", "HTTPS", "HTTP_PROXY", "HTTPS_PROXY"].includes(node.protocol)) {
    throw new Error("Invalid daemon protocol");
  }
}

/**
 * Sanitize log output to prevent sensitive data leakage
 */
export function sanitizeForLog(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "authorization",
    "cookie",
    "session",
    "creditCard",
    "credit_card",
    "ssn",
    "privateKey",
    "private_key",
  ];

  const sanitized = { ...data } as Record<string, unknown>;

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLog(sanitized[key]);
    }
  }

  return sanitized;
}
