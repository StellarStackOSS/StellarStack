/**
 * Rate limiting middleware for Hono
 *
 * Implements token bucket algorithm for rate limiting
 * Different limits for different endpoint types
 */

import type { Context, Next } from "hono";
import type { RateLimitEntry, RateLimitConfig } from "./rate-limit.types";

// Re-export types for backwards compatibility
export type { RateLimitEntry, RateLimitConfig } from "./rate-limit.types";

// In-memory store for rate limiting (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    // Remove entries older than 1 hour
    if (now - entry.lastRefill > 3600000) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

/**
 * Get client IP address from request
 */
const getClientIp = (c: Context): string => {
  // Check common headers for proxied requests
  const xForwardedFor = c.req.header("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0];
    return firstIp?.trim() ?? "unknown";
  }

  const xRealIp = c.req.header("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }

  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to connection info
  return "unknown";
};

/**
 * Create a rate limiting middleware
 */
export const rateLimit = (config: RateLimitConfig) => {
  const {
    maxRequests,
    windowMs,
    message = "Too many requests, please try again later",
    keyGenerator = getClientIp,
    skip,
  } = config;

  return async (c: Context, next: Next) => {
    // Check if we should skip rate limiting
    if (skip && skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry) {
      entry = { tokens: maxRequests, lastRefill: now };
      rateLimitStore.set(key, entry);
    }

    // Calculate token refill based on time passed
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor((timePassed / windowMs) * maxRequests);

    if (tokensToAdd > 0) {
      entry.tokens = Math.min(maxRequests, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }

    // Check if we have tokens available
    if (entry.tokens <= 0) {
      const retryAfter = Math.ceil((windowMs - (now - entry.lastRefill)) / 1000);

      c.header("Retry-After", String(retryAfter));
      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil((entry.lastRefill + windowMs) / 1000)));

      return c.json({ error: message }, 429);
    }

    // Consume a token
    entry.tokens -= 1;

    // Add rate limit headers
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, entry.tokens)));
    c.header("X-RateLimit-Reset", String(Math.ceil((entry.lastRefill + windowMs) / 1000)));

    return next();
  };
};

// ============================================================================
// Preset Rate Limiters
// ============================================================================

/**
 * Strict rate limit for authentication endpoints
 * 5 attempts per minute
 */
export const authRateLimit = rateLimit({
  maxRequests: 5,
  windowMs: 60000, // 1 minute
  message: "Too many authentication attempts, please try again in a minute",
});

/**
 * Rate limit for password reset / email verification
 * 3 attempts per 15 minutes
 */
export const sensitiveRateLimit = rateLimit({
  maxRequests: 3,
  windowMs: 900000, // 15 minutes
  message: "Too many requests for this sensitive operation, please try again later",
});

/**
 * General API rate limit
 * 100 requests per minute
 */
export const apiRateLimit = rateLimit({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  message: "API rate limit exceeded, please slow down",
});

/**
 * Strict rate limit for server actions (start/stop/restart)
 * 10 actions per minute per server
 */
export const serverActionRateLimit = rateLimit({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: "Too many server actions, please wait before trying again",
  keyGenerator: (c) => {
    const ip = getClientIp(c);
    const serverId = c.req.param("serverId") || c.req.param("id") || "unknown";
    return `${ip}:${serverId}`;
  },
});

/**
 * Rate limit for file operations
 * 30 operations per minute
 */
export const fileOperationRateLimit = rateLimit({
  maxRequests: 30,
  windowMs: 60000, // 1 minute
  message: "Too many file operations, please slow down",
});

/**
 * Rate limit for webhook testing
 * 5 tests per minute
 */
export const webhookTestRateLimit = rateLimit({
  maxRequests: 5,
  windowMs: 60000, // 1 minute
  message: "Too many webhook tests, please wait before testing again",
});
