/**
 * Transfer operation routes for the mock daemon.
 * Implements initiate, status, receive, and cancel transfer endpoints.
 */

import { Hono } from "hono";
import type { InitiateTransferRequest } from "../Types.js";
import { GetServer } from "../State.js";
import { GenerateChecksum, RandomBetween } from "../Generators.js";
import { BroadcastToServer } from "../Websocket.js";

const TransferRoutes = new Hono();

/**
 * POST /transfer — Initiate a server transfer.
 */
TransferRoutes.post("/", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.is_transferring) {
    return c.json({ error: "Transfer already in progress" }, 409);
  }

  await c.req.json<InitiateTransferRequest>();

  server.is_transferring = true;
  BroadcastToServer(serverId, { event: "transfer started", args: [{}] });

  /** Simulate transfer progress */
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += RandomBetween(10, 25);
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);

      server.is_transferring = false;
      BroadcastToServer(serverId, { event: "transfer completed", args: [{ successful: true }] });
    } else {
      BroadcastToServer(serverId, { event: "transfer progress", args: [{ progress }] });
    }
  }, 500);

  return c.json({
    success: true,
    message: "Transfer initiated",
    checksum: GenerateChecksum(),
    size: RandomBetween(50 * 1024 * 1024, 2 * 1024 * 1024 * 1024),
  });
});

/**
 * GET /transfer — Get transfer status.
 */
TransferRoutes.get("/", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  return c.json({
    success: true,
    message: server.is_transferring ? "Transfer in progress" : "No active transfer",
  });
});

/**
 * POST /transfer/receive — Receive a transfer archive.
 */
TransferRoutes.post("/receive", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  return c.json({ success: true });
});

/**
 * POST /transfer/cancel — Cancel an active transfer.
 */
TransferRoutes.post("/cancel", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  server.is_transferring = false;
  BroadcastToServer(serverId, { event: "transfer completed", args: [{ successful: false }] });

  return c.json({ success: true });
});

export default TransferRoutes;
