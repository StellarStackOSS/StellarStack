/**
 * Type definitions for rate limiting middleware
 */

import type { Context } from "hono";

/**
 * Rate limit entry stored in memory
 */
export interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Message to return when rate limited */
  message?: string;
  /** Key generator function (defaults to IP) */
  keyGenerator?: (c: Context) => string;
  /** Skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
}
