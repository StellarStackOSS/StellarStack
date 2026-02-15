/**
 * Authentication middleware for the mock daemon.
 * Accepts any Bearer token in the format `Bearer X.Y` without validation.
 */

import type { Context, Next } from "hono";

/**
 * Bearer token auth middleware.
 * Checks that the Authorization header contains a Bearer token with at least
 * one dot (matching the `{token_id}.{token}` format used by the real daemon).
 * Does not validate the actual token — this is a mock.
 *
 * @param c - Hono context
 * @param next - Next middleware function
 * @returns Response or passes to next handler
 */
const AuthMiddleware = async (c: Context, next: Next): Promise<Response> => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (!token.includes(".")) {
    return c.json({ error: "Invalid token format, expected {token_id}.{token}" }, 401);
  }

  await next();
  return c.res;
};

export { AuthMiddleware };
