/**
 * Backup operation routes for the mock daemon.
 * Implements list, create, restore, and delete backup endpoints.
 */

import { Hono } from "hono";
import type { CreateBackupRequest, RestoreBackupRequest } from "../Types.js";
import { GetServer, AddBackup, GetBackups, DeleteBackup } from "../State.js";
import { GenerateChecksum, RandomBetween } from "../Generators.js";
import { BroadcastToServer } from "../Websocket.js";

const BackupRoutes = new Hono();

/**
 * GET /backup — List all backups for a server.
 */
BackupRoutes.get("/", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  return c.json({ backups: GetBackups(serverId) });
});

/**
 * POST /backup — Create a new backup.
 */
BackupRoutes.post("/", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<CreateBackupRequest>();
  const size = RandomBetween(1024 * 1024, 500 * 1024 * 1024);
  const checksum = GenerateChecksum();

  BroadcastToServer(serverId, { event: "backup started", args: [{ uuid: body.uuid }] });

  /** Simulate backup taking 2 seconds */
  setTimeout(() => {
    AddBackup(serverId, {
      uuid: body.uuid,
      size,
      created_at: Math.floor(Date.now() / 1000),
    });

    BroadcastToServer(serverId, {
      event: "backup completed",
      args: [{ uuid: body.uuid, successful: true, checksum, size }],
    });
  }, 2000);

  return c.json({ success: true, checksum, size });
});

/**
 * POST /backup/restore — Restore a backup.
 */
BackupRoutes.post("/restore", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<RestoreBackupRequest>();

  server.is_restoring = true;
  BroadcastToServer(serverId, { event: "backup restore started", args: [{ uuid: body.backup_id }] });

  /** Simulate restore taking 2 seconds */
  setTimeout(() => {
    server.is_restoring = false;
    BroadcastToServer(serverId, {
      event: "backup restore completed",
      args: [{ uuid: body.backup_id, successful: true }],
    });
  }, 2000);

  return c.json({ success: true });
});

/**
 * DELETE /backup/:backup_id — Delete a backup.
 */
BackupRoutes.delete("/:backup_id", (c) => {
  const serverId = c.req.param("server_id") as string;
  const backupId = c.req.param("backup_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const deleted = DeleteBackup(serverId, backupId);
  if (!deleted) {
    return c.json({ error: "Backup not found" }, 404);
  }

  return c.json({ success: true });
});

export default BackupRoutes;
