/**
 * Plugin operation routes for the mock daemon.
 * Implements download, write, delete, delete-all, backup, control, and command endpoints.
 */

import { Hono } from "hono";
import type {
  PluginDownloadRequest,
  PluginWriteRequest,
  PluginDeleteRequest,
  PluginServerControlRequest,
  PluginCommandRequest,
  DaemonResponse,
  MockFile,
} from "../Types.js";
import { GetServer, SetFile, DeleteFile, GetFile, AddConsoleLine } from "../State.js";
import { GenerateUUID } from "../Generators.js";
import { BroadcastToServer } from "../Websocket.js";

const PluginRoutes = new Hono();

/**
 * POST /plugins/download — Download a plugin from a URL.
 */
PluginRoutes.post("/download", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PluginDownloadRequest>();
  const now = Math.floor(Date.now() / 1000);
  const fileName = body.dest_path.split("/").pop() ?? "plugin.jar";

  const file: MockFile = {
    name: fileName,
    content: `[downloaded from: ${body.url}]`,
    is_directory: false,
    size: 1024 * 512,
    modified: now,
    created: now,
    mode: 0o644,
  };

  SetFile(serverId, body.dest_path, file);

  const response: DaemonResponse = { success: true, message: `Downloaded ${fileName}` };
  return c.json(response);
});

/**
 * POST /plugins/write — Write plugin file content.
 */
PluginRoutes.post("/write", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PluginWriteRequest>();
  const now = Math.floor(Date.now() / 1000);
  const existing = GetFile(serverId, body.path);
  const name = body.path.split("/").pop() ?? "file";

  let content = body.content;
  if (body.append && existing) {
    content = existing.content + body.content;
  }

  const file: MockFile = {
    name,
    content,
    is_directory: false,
    size: content.length,
    modified: now,
    created: existing?.created ?? now,
    mode: body.mode ? parseInt(body.mode, 8) : (existing?.mode ?? 0o644),
  };

  SetFile(serverId, body.path, file);

  const response: DaemonResponse = { success: true, message: `Written ${name}` };
  return c.json(response);
});

/**
 * DELETE /plugins/delete — Delete a plugin file.
 */
PluginRoutes.delete("/delete", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PluginDeleteRequest>();
  DeleteFile(serverId, body.path);

  const response: DaemonResponse = { success: true, message: "Deleted" };
  return c.json(response);
});

/**
 * DELETE /plugins/delete-all — Delete all plugins.
 */
PluginRoutes.delete("/delete-all", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  /** Delete all files under /plugins */
  const toDelete: string[] = [];
  for (const key of server.files.keys()) {
    if (key.startsWith("/plugins/")) {
      toDelete.push(key);
    }
  }
  for (const key of toDelete) {
    server.files.delete(key);
  }

  const response: DaemonResponse = { success: true, message: `Deleted ${toDelete.length} plugin files` };
  return c.json(response);
});

/**
 * POST /plugins/backup — Create a plugin backup.
 */
PluginRoutes.post("/backup", (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const backupId = GenerateUUID();
  return c.json({ success: true, backup_id: backupId, name: `plugin-backup-${backupId.slice(0, 8)}` });
});

/**
 * POST /plugins/control — Execute a plugin server control action.
 */
PluginRoutes.post("/control", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PluginServerControlRequest>();

  switch (body.action) {
    case "start":
      if (server.state === "offline") {
        server.state = "starting";
        BroadcastToServer(serverId, { event: "status", args: [{ state: "starting" }] });
        setTimeout(() => {
          server.state = "running";
          server.started_at = Math.floor(Date.now() / 1000);
          BroadcastToServer(serverId, { event: "status", args: [{ state: "running" }] });
        }, 500);
      }
      break;
    case "stop":
      if (server.state === "running") {
        server.state = "stopping";
        BroadcastToServer(serverId, { event: "status", args: [{ state: "stopping" }] });
        setTimeout(() => {
          server.state = "offline";
          server.started_at = undefined;
          BroadcastToServer(serverId, { event: "status", args: [{ state: "offline" }] });
        }, 300);
      }
      break;
    case "restart":
      if (server.state === "running") {
        server.state = "stopping";
        BroadcastToServer(serverId, { event: "status", args: [{ state: "stopping" }] });
        setTimeout(() => {
          server.state = "starting";
          BroadcastToServer(serverId, { event: "status", args: [{ state: "starting" }] });
          setTimeout(() => {
            server.state = "running";
            server.started_at = Math.floor(Date.now() / 1000);
            BroadcastToServer(serverId, { event: "status", args: [{ state: "running" }] });
          }, 500);
        }, 300);
      }
      break;
  }

  const response: DaemonResponse = { success: true, message: `Action ${body.action} executed` };
  return c.json(response);
});

/**
 * POST /plugins/command — Execute a plugin command on the server.
 */
PluginRoutes.post("/command", async (c) => {
  const serverId = c.req.param("server_id") as string;
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PluginCommandRequest>();
  const timestamp = Math.floor(Date.now() / 1000);

  AddConsoleLine(serverId, `[Plugin] > ${body.command}`);
  BroadcastToServer(serverId, {
    event: "console output",
    args: [{ line: `[Plugin] > ${body.command}`, timestamp }],
  });

  const response: DaemonResponse = { success: true, message: `Command executed: ${body.command}` };
  return c.json(response);
});

export default PluginRoutes;
