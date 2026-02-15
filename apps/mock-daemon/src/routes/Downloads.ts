/**
 * Token-authenticated download and upload routes for the mock daemon.
 * Implements /download/backup, /download/file, and /upload/file endpoints.
 * These use JWT query parameters instead of Bearer header auth.
 */

import { Hono } from "hono";
import { GetServer, GetFile, SetFile } from "../State.js";
import type { MockFile } from "../Types.js";

const DownloadRoutes = new Hono();

/**
 * GET /download/backup — Download a backup archive.
 * Auth via ?token= query parameter (JWT — not validated in mock).
 */
DownloadRoutes.get("/download/backup", (c) => {
  const token = c.req.query("token");
  const serverId = c.req.query("server");
  const backupId = c.req.query("backup");

  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  if (!serverId || !backupId) {
    return c.json({ error: "Missing server or backup parameter" }, 400);
  }

  const server = GetServer(serverId);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const backup = server.backups.get(backupId);
  if (!backup) {
    return c.json({ error: "Backup not found" }, 404);
  }

  /** Return fake backup data */
  const content = `[mock backup data for ${backupId}]`;
  return new Response(content, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="backup-${backupId}.tar.gz"`,
      "Content-Length": String(content.length),
    },
  });
});

/**
 * GET /download/file — Download a file from a server.
 * Auth via ?token= query parameter (JWT — not validated in mock).
 */
DownloadRoutes.get("/download/file", (c) => {
  const token = c.req.query("token");
  const serverId = c.req.query("server");
  const filePath = c.req.query("file");

  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  if (!serverId || !filePath) {
    return c.json({ error: "Missing server or file parameter" }, 400);
  }

  const server = GetServer(serverId);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const file = GetFile(serverId, filePath);
  if (!file || file.is_directory) {
    return c.json({ error: "File not found" }, 404);
  }

  return new Response(file.content, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Content-Length": String(file.content.length),
    },
  });
});

/**
 * POST /upload/file — Upload a file to a server.
 * Auth via ?token= query parameter.
 */
DownloadRoutes.post("/upload/file", async (c) => {
  const token = c.req.query("token");
  const serverId = c.req.query("server");
  const directory = c.req.query("directory") ?? "/";

  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  if (!serverId) {
    return c.json({ error: "Missing server parameter" }, 400);
  }

  const server = GetServer(serverId);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  const uploadedFiles: string[] = [];

  try {
    const formData = await c.req.formData();
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const fileName = value.name || key;
        const fullPath = `${directory}/${fileName}`.replace(/\/+/g, "/");
        const content = await value.text();

        const file: MockFile = {
          name: fileName,
          content,
          is_directory: false,
          size: value.size,
          modified: now,
          created: now,
          mode: 0o644,
        };

        SetFile(serverId, fullPath, file);
        uploadedFiles.push(fileName);
      }
    }
  } catch {
    uploadedFiles.push("mock-uploaded-file");
  }

  return c.json({ success: true, files: uploadedFiles });
});

export default DownloadRoutes;
