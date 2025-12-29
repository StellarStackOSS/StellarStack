import { WebSocket } from "ws";

// Event types that can be broadcast to clients
export type WSEventType =
  | "server:created"
  | "server:updated"
  | "server:deleted"
  | "server:status"
  | "server:stats"
  | "node:updated"
  | "node:status"
  | "backup:created"
  | "backup:deleted"
  | "backup:status";

export interface WSEvent {
  type: WSEventType;
  data: unknown;
  // Optional: scope events to specific users
  userId?: string;
  // Optional: scope events to specific servers
  serverId?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  // Servers the client is subscribed to
  subscribedServers: Set<string>;
}

class WebSocketManager {
  private clients: Map<WebSocket, ConnectedClient> = new Map();

  addClient(ws: WebSocket, userId?: string) {
    this.clients.set(ws, {
      ws,
      userId,
      subscribedServers: new Set(),
    });
    console.log(`WebSocket client connected. Total clients: ${this.clients.size}`);
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
    console.log(`WebSocket client disconnected. Total clients: ${this.clients.size}`);
  }

  // Subscribe client to server updates
  subscribeToServer(ws: WebSocket, serverId: string) {
    const client = this.clients.get(ws);
    if (client) {
      client.subscribedServers.add(serverId);
    }
  }

  // Unsubscribe client from server updates
  unsubscribeFromServer(ws: WebSocket, serverId: string) {
    const client = this.clients.get(ws);
    if (client) {
      client.subscribedServers.delete(serverId);
    }
  }

  // Broadcast event to all connected clients
  broadcast(event: WSEvent) {
    const message = JSON.stringify(event);

    for (const [, client] of this.clients) {
      // If event is scoped to a user, only send to that user
      if (event.userId && client.userId !== event.userId) {
        continue;
      }

      // If event is scoped to a server, only send to subscribed clients
      if (event.serverId && !client.subscribedServers.has(event.serverId)) {
        continue;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  // Broadcast to a specific user
  broadcastToUser(userId: string, event: WSEvent) {
    this.broadcast({ ...event, userId });
  }

  // Broadcast to clients subscribed to a server
  broadcastToServer(serverId: string, event: WSEvent) {
    this.broadcast({ ...event, serverId });
  }

  // Handle incoming messages from clients
  handleMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "subscribe":
          if (data.serverId) {
            this.subscribeToServer(ws, data.serverId);
          }
          break;
        case "unsubscribe":
          if (data.serverId) {
            this.unsubscribeFromServer(ws, data.serverId);
          }
          break;
        case "ping":
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "pong" }));
          }
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// Helper to emit server events
export function emitServerEvent(
  type: WSEventType,
  serverId: string,
  data: unknown,
  userId?: string
) {
  wsManager.broadcast({
    type,
    serverId,
    data,
    userId,
  });
}

// Helper to emit global events
export function emitGlobalEvent(type: WSEventType, data: unknown) {
  wsManager.broadcast({ type, data });
}
