import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

import { auth } from "./lib/auth";
import { account } from "./routes/account";
import { locations } from "./routes/locations";
import { nodes } from "./routes/nodes";
import { blueprints } from "./routes/blueprints";
import { servers } from "./routes/servers";
import { webhooks } from "./routes/webhooks";
import { domains } from "./routes/domains";
import { remote } from "./routes/remote";

const app = new Hono();

// Middleware
app.use("*", logger());

// CORS for auth routes (must be before the auth handler)
app.use(
  "/api/auth/*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  })
);

// Better Auth routes
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// CORS for other API routes
app.use(
  "/api/*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.route("/api/account", account);
app.route("/api/locations", locations);
app.route("/api/nodes", nodes);
app.route("/api/blueprints", blueprints);
app.route("/api/servers", servers);
app.route("/api/webhooks", webhooks);
app.route("/api/servers", domains); // Domain routes under /api/servers/:serverId/subdomain and /domains

// Daemon-facing API routes (node authentication required)
app.route("/api/remote", remote);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// Start server
const port = parseInt(process.env.PORT || "3001");
const hostname = process.env.HOSTNAME || "::";

console.log(`Starting API server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
  hostname,
});

console.log(`API server running at http://localhost:${port}`);
