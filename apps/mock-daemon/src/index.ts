/**
 * Mock daemon entry point.
 * Sets up a Hono HTTP server with WebSocket support that emulates the full
 * Rust daemon API surface with in-memory state.
 */

import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { AuthMiddleware } from "./Middleware.js";
import { HandleOpen, HandleMessage, HandleClose } from "./Websocket.js";
import SystemRoutes from "./routes/System.js";
import ServerRoutes from "./routes/Servers.js";
import FileRoutes from "./routes/Files.js";
import BackupRoutes from "./routes/Backups.js";
import TransferRoutes from "./routes/Transfers.js";
import ScheduleRoutes from "./routes/Schedules.js";
import PluginRoutes from "./routes/Plugins.js";
import DownloadRoutes from "./routes/Downloads.js";

const PORT = parseInt(process.env.PORT ?? "8080", 10);

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

/** Global middleware */
app.use("*", cors());
app.use("*", logger());

/** Health check (no auth) */
app.get("/health", (c) => c.json({ status: "ok", mock: true }));

/** Token-auth download/upload routes (no Bearer auth — uses query token) */
app.route("/", DownloadRoutes);

/** Apply Bearer auth to all /api routes */
app.use("/api/*", AuthMiddleware);

/** System routes */
app.route("/api", SystemRoutes);

/** Server CRUD routes */
app.route("/api/servers", ServerRoutes);

/** Per-server sub-routes */
app.route("/api/servers/:server_id/files", FileRoutes);
app.route("/api/servers/:server_id/backup", BackupRoutes);
app.route("/api/servers/:server_id/transfer", TransferRoutes);
app.route("/api/servers/:server_id/schedules", ScheduleRoutes);
app.route("/api/servers/:server_id/plugins", PluginRoutes);

/** WebSocket endpoint for real-time console and stats */
app.get(
  "/api/servers/:server_id/ws",
  upgradeWebSocket((c) => {
    const serverId = c.req.param("server_id") as string;

    return {
      onOpen(_event, ws) {
        HandleOpen(serverId, ws);
      },
      onMessage(event, ws) {
        HandleMessage(serverId, ws, event.data);
      },
      onClose(_event, ws) {
        HandleClose(serverId, ws);
      },
    };
  })
);

/** 404 fallback */
app.notFound((c) => c.json({ error: "Not found" }, 404));

/** Error handler */
app.onError((err, c) => {
  console.error(`[mock-daemon] Error: ${err.message}`);
  return c.json({ error: err.message }, 500);
});

/** Start server */
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[mock-daemon] Listening on http://localhost:${info.port}`);
  console.log("[mock-daemon] Mock daemon ready — all endpoints active");
});

injectWebSocket(server);
