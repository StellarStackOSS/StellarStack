/**
 * Server CRUD, power, commands, and log routes for the mock daemon.
 */

import { Hono } from "hono";
import type {
  CreateServerRequest,
  PowerActionRequest,
  SendCommandRequest,
  ServerSummary,
  ServerResponse,
} from "../Types.js";
import { CreateServer, GetServer, DeleteServer, GetAllServers, AddConsoleLine } from "../State.js";
import { BroadcastToServer } from "../Websocket.js";

const ServerRoutes = new Hono();

/**
 * GET /api/servers — List all servers.
 */
ServerRoutes.get("/", (c) => {
  const entries = GetAllServers();
  const servers: ServerSummary[] = entries.map(([uuid, s]) => ({
    uuid,
    name: s.config.name,
    state: s.state,
    is_installing: s.is_installing,
    is_transferring: s.is_transferring,
    is_restoring: s.is_restoring,
    suspended: s.suspended,
  }));
  return c.json({ servers });
});

/**
 * POST /api/servers — Create a new server.
 */
ServerRoutes.post("/", async (c) => {
  const body = await c.req.json<CreateServerRequest>();

  if (!body.uuid || !body.name) {
    return c.json({ error: "uuid and name are required" }, 400);
  }

  if (GetServer(body.uuid)) {
    return c.json({ error: "Server with this UUID already exists" }, 409);
  }

  const server = CreateServer(body.uuid, body.name, body);

  const response: ServerResponse = {
    uuid: body.uuid,
    name: body.name,
    state: server.state,
    is_installing: server.is_installing,
    is_transferring: server.is_transferring,
    is_restoring: server.is_restoring,
    suspended: server.suspended,
    invocation: body.invocation ?? "",
    container: body.container ?? { image: "ghcr.io/stellarstack/mock:latest", oom_disabled: false },
  };

  return c.json(response, 201);
});

/**
 * GET /api/servers/:server_id — Get server details.
 */
ServerRoutes.get("/:server_id", (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const response: ServerResponse = {
    uuid: serverId,
    name: server.config.name,
    state: server.state,
    is_installing: server.is_installing,
    is_transferring: server.is_transferring,
    is_restoring: server.is_restoring,
    suspended: server.suspended,
    invocation: server.config.invocation ?? "",
    container: server.config.container ?? {
      image: "ghcr.io/stellarstack/mock:latest",
      oom_disabled: false,
    },
  };

  return c.json(response);
});

/**
 * PATCH /api/servers/:server_id — Update server configuration.
 */
ServerRoutes.patch("/:server_id", async (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const updates = await c.req.json<Partial<CreateServerRequest>>();

  if (updates.name) server.config.name = updates.name;
  if (updates.invocation) server.config.invocation = updates.invocation;
  if (updates.build) server.config.build = { ...server.config.build, ...updates.build };
  if (updates.container)
    server.config.container = { ...server.config.container, ...updates.container };
  if (updates.suspended !== undefined) server.suspended = updates.suspended;

  return c.json({ success: true });
});

/**
 * DELETE /api/servers/:server_id — Delete a server.
 */
ServerRoutes.delete("/:server_id", (c) => {
  const serverId = c.req.param("server_id");

  if (!GetServer(serverId)) {
    return c.json({ error: "Server not found" }, 404);
  }

  DeleteServer(serverId);
  return c.json({ success: true });
});

/**
 * POST /api/servers/:server_id/power — Execute a power action.
 */
ServerRoutes.post("/:server_id/power", async (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const body = await c.req.json<PowerActionRequest>();

  switch (body.action) {
    case "start": {
      if (server.state !== "offline") {
        return c.json({ error: "Server is not offline" }, 409);
      }
      server.state = "starting";
      BroadcastToServer(serverId, { event: "status", args: [{ state: "starting" }] });

      setTimeout(() => {
        server.state = "running";
        server.started_at = Math.floor(Date.now() / 1000);
        BroadcastToServer(serverId, { event: "status", args: [{ state: "running" }] });
        AddConsoleLine(serverId, "[INFO] Server started successfully");
      }, 500);
      break;
    }
    case "stop": {
      if (server.state !== "running") {
        return c.json({ error: "Server is not running" }, 409);
      }
      server.state = "stopping";
      BroadcastToServer(serverId, { event: "status", args: [{ state: "stopping" }] });

      setTimeout(() => {
        server.state = "offline";
        server.started_at = undefined;
        BroadcastToServer(serverId, { event: "status", args: [{ state: "offline" }] });
      }, 300);
      break;
    }
    case "restart": {
      if (server.state !== "running") {
        return c.json({ error: "Server is not running" }, 409);
      }
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
      break;
    }
    case "kill": {
      server.state = "offline";
      server.started_at = undefined;
      BroadcastToServer(serverId, { event: "status", args: [{ state: "offline" }] });
      break;
    }
    default:
      return c.json({ error: `Unknown power action: ${body.action}` }, 400);
  }

  return c.json({ success: true });
});

/**
 * POST /api/servers/:server_id/commands — Send a console command.
 */
ServerRoutes.post("/:server_id/commands", async (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.state !== "running") {
    return c.json({ error: "Server is not running" }, 409);
  }

  const body = await c.req.json<SendCommandRequest>();
  const timestamp = Math.floor(Date.now() / 1000);

  AddConsoleLine(serverId, `> ${body.command}`);
  BroadcastToServer(serverId, {
    event: "console output",
    args: [{ line: `> ${body.command}`, timestamp }],
  });

  /** Fake response after short delay */
  setTimeout(() => {
    const response = `[INFO] Executed command: ${body.command}`;
    const responseTs = Math.floor(Date.now() / 1000);
    AddConsoleLine(serverId, response);
    BroadcastToServer(serverId, {
      event: "console output",
      args: [{ line: response, timestamp: responseTs }],
    });
  }, 150);

  return c.json({ success: true });
});

/**
 * GET /api/servers/:server_id/logs — Get server console logs.
 */
ServerRoutes.get("/:server_id/logs", (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  return c.json(server.console_buffer.map((entry) => entry.line));
});

/**
 * POST /api/servers/:server_id/install — Trigger server installation.
 */
ServerRoutes.post("/:server_id/install", (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  server.is_installing = true;
  BroadcastToServer(serverId, { event: "install started", args: [{}] });

  /** Simulate installation completing after 3 seconds */
  setTimeout(() => {
    server.is_installing = false;
    BroadcastToServer(serverId, { event: "install completed", args: [{ successful: true }] });
  }, 3000);

  return c.json({ success: true, message: "Installation started" });
});

/**
 * POST /api/servers/:server_id/reinstall — Trigger server reinstallation.
 */
ServerRoutes.post("/:server_id/reinstall", (c) => {
  const serverId = c.req.param("server_id");
  const server = GetServer(serverId);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  server.is_installing = true;
  server.state = "offline";
  server.started_at = undefined;
  server.console_buffer = [];
  BroadcastToServer(serverId, { event: "install started", args: [{}] });

  setTimeout(() => {
    server.is_installing = false;
    BroadcastToServer(serverId, { event: "install completed", args: [{ successful: true }] });
  }, 3000);

  return c.json({ success: true, message: "Reinstallation started" });
});

/**
 * POST /api/servers/:server_id/sync — Sync server with panel.
 */
ServerRoutes.post("/:server_id/sync", (c) => {
  const serverId = c.req.param("server_id");

  if (!GetServer(serverId)) {
    return c.json({ error: "Server not found" }, 404);
  }

  return c.json({ success: true });
});

export default ServerRoutes;
