/**
 * WebSocket handler for the mock daemon.
 * Emulates real-time console output, stats, and power control via WebSocket.
 * Uses Hono's WSContext callback API (onOpen/onMessage/onClose).
 */

import type { WSContext, WSMessageReceive } from "hono/ws";
import type { WsIncomingMessage } from "./Types.js";
import { GetServer, AddConsoleLine } from "./State.js";
import { GenerateWsStats, GenerateLogLine } from "./Generators.js";

/** Active WebSocket connections mapped by server UUID */
const activeConnections = new Map<string, Set<WSContext>>();

/** Interval handles per WebSocket connection for cleanup */
const connectionIntervals = new Map<
  WSContext,
  { stats: ReturnType<typeof setInterval>; console: ReturnType<typeof setInterval> }
>();

/**
 * Called when a WebSocket connection opens. Sends initial state and starts intervals.
 *
 * @param serverId - The server UUID
 * @param ws - The WebSocket context
 */
const HandleOpen = (serverId: string, ws: WSContext): void => {
  const server = GetServer(serverId);

  /** Send auth success */
  ws.send(JSON.stringify({ event: "auth success", args: [{}] }));

  /** Send current status */
  const state = server?.state ?? "offline";
  ws.send(JSON.stringify({ event: "status", args: [{ state }] }));

  /** Send console history if available */
  if (server && server.console_buffer.length > 0) {
    ws.send(
      JSON.stringify({
        event: "console history",
        args: [{ lines: server.console_buffer.slice(-100) }],
      })
    );
  }

  /** Track this connection */
  if (!activeConnections.has(serverId)) {
    activeConnections.set(serverId, new Set());
  }
  activeConnections.get(serverId)?.add(ws);

  /** Stats interval — every 2s when server is running */
  const statsInterval = setInterval(() => {
    const currentServer = GetServer(serverId);
    if (!currentServer || currentServer.state !== "running") return;

    const memLimit = currentServer.config.build?.memory_limit ?? 2048;
    const memLimitBytes = memLimit > 0 ? memLimit * 1024 * 1024 : 4 * 1024 * 1024 * 1024;
    const startedAt = currentServer.started_at ?? Math.floor(Date.now() / 1000);
    const stats = GenerateWsStats(memLimitBytes, startedAt);

    try {
      ws.send(JSON.stringify({ event: "stats", args: [stats] }));
    } catch {
      clearInterval(statsInterval);
    }
  }, 2000);

  /** Console output interval — every 5s when server is running */
  const consoleInterval = setInterval(() => {
    const currentServer = GetServer(serverId);
    if (!currentServer || currentServer.state !== "running") return;

    const line = GenerateLogLine();
    const timestamp = Math.floor(Date.now() / 1000);
    AddConsoleLine(serverId, line);

    try {
      ws.send(JSON.stringify({ event: "console output", args: [{ line, timestamp }] }));
    } catch {
      clearInterval(consoleInterval);
    }
  }, 5000);

  connectionIntervals.set(ws, { stats: statsInterval, console: consoleInterval });
};

/**
 * Called when a WebSocket message is received from a client.
 *
 * @param serverId - The server UUID
 * @param ws - The WebSocket context
 * @param data - Raw message data
 */
const HandleMessage = (serverId: string, ws: WSContext, data: WSMessageReceive): void => {
  try {
    const parsed = JSON.parse(String(data)) as WsIncomingMessage;
    HandleIncomingMessage(serverId, ws, parsed);
  } catch {
    /** Ignore malformed messages */
  }
};

/**
 * Called when a WebSocket connection closes. Cleans up intervals and tracking.
 *
 * @param serverId - The server UUID
 * @param ws - The WebSocket context
 */
const HandleClose = (serverId: string, ws: WSContext): void => {
  const intervals = connectionIntervals.get(ws);
  if (intervals) {
    clearInterval(intervals.stats);
    clearInterval(intervals.console);
    connectionIntervals.delete(ws);
  }

  activeConnections.get(serverId)?.delete(ws);
  if (activeConnections.get(serverId)?.size === 0) {
    activeConnections.delete(serverId);
  }
};

/**
 * Processes incoming WebSocket messages from clients.
 *
 * @param serverId - The server UUID
 * @param ws - The WebSocket context
 * @param message - Parsed incoming message
 */
const HandleIncomingMessage = (
  serverId: string,
  ws: WSContext,
  message: WsIncomingMessage
): void => {
  const server = GetServer(serverId);
  if (!server) {
    ws.send(JSON.stringify({ event: "error", args: [{ message: "Server not found" }] }));
    return;
  }

  switch (message.event) {
    case "send command": {
      const command = String(message.args[0] ?? "");
      const timestamp = Math.floor(Date.now() / 1000);
      const line = `> ${command}`;
      AddConsoleLine(serverId, line);
      BroadcastToServer(serverId, { event: "console output", args: [{ line, timestamp }] });

      /** Echo a fake response after a short delay */
      setTimeout(() => {
        const response = `[INFO] Executed command: ${command}`;
        const responseTs = Math.floor(Date.now() / 1000);
        AddConsoleLine(serverId, response);
        BroadcastToServer(serverId, {
          event: "console output",
          args: [{ line: response, timestamp: responseTs }],
        });
      }, 200);
      break;
    }

    case "set state": {
      const action = String(message.args[0] ?? "");
      HandlePowerAction(serverId, action);
      break;
    }

    case "send logs": {
      if (server.console_buffer.length > 0) {
        ws.send(
          JSON.stringify({
            event: "console history",
            args: [{ lines: server.console_buffer.slice(-100) }],
          })
        );
      }
      break;
    }

    case "send stats": {
      if (server.state === "running") {
        const memLimit = server.config.build?.memory_limit ?? 2048;
        const memLimitBytes = memLimit > 0 ? memLimit * 1024 * 1024 : 4 * 1024 * 1024 * 1024;
        const startedAt = server.started_at ?? Math.floor(Date.now() / 1000);
        const stats = GenerateWsStats(memLimitBytes, startedAt);
        ws.send(JSON.stringify({ event: "stats", args: [stats] }));
      }
      break;
    }

    default:
      break;
  }
};

/**
 * Handles power state transitions triggered via WebSocket.
 *
 * @param serverId - The server UUID
 * @param action - Power action string
 */
const HandlePowerAction = (serverId: string, action: string): void => {
  const server = GetServer(serverId);
  if (!server) return;

  switch (action) {
    case "start": {
      if (server.state !== "offline") return;
      server.state = "starting";
      BroadcastToServer(serverId, { event: "status", args: [{ state: "starting" }] });

      setTimeout(() => {
        server.state = "running";
        server.started_at = Math.floor(Date.now() / 1000);
        BroadcastToServer(serverId, { event: "status", args: [{ state: "running" }] });

        const line = "[INFO] Server started successfully";
        const timestamp = Math.floor(Date.now() / 1000);
        AddConsoleLine(serverId, line);
        BroadcastToServer(serverId, { event: "console output", args: [{ line, timestamp }] });
      }, 500);
      break;
    }

    case "stop": {
      if (server.state !== "running") return;
      server.state = "stopping";
      BroadcastToServer(serverId, { event: "status", args: [{ state: "stopping" }] });

      const stopLine = "[INFO] Stopping the server...";
      const stopTs = Math.floor(Date.now() / 1000);
      AddConsoleLine(serverId, stopLine);
      BroadcastToServer(serverId, {
        event: "console output",
        args: [{ line: stopLine, timestamp: stopTs }],
      });

      setTimeout(() => {
        server.state = "offline";
        server.started_at = undefined;
        BroadcastToServer(serverId, { event: "status", args: [{ state: "offline" }] });
      }, 300);
      break;
    }

    case "restart": {
      if (server.state !== "running") return;
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
      break;
  }
};

/**
 * Broadcasts a message to all WebSocket connections for a given server.
 *
 * @param serverId - The server UUID
 * @param message - Message object to send
 */
const BroadcastToServer = (serverId: string, message: { event: string; args: unknown[] }): void => {
  const connections = activeConnections.get(serverId);
  if (!connections) return;

  const data = JSON.stringify(message);
  for (const ws of connections) {
    try {
      ws.send(data);
    } catch {
      connections.delete(ws);
    }
  }
};

export { HandleOpen, HandleMessage, HandleClose, BroadcastToServer, HandlePowerAction };
