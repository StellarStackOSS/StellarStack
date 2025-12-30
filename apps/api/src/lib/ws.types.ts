/**
 * Type definitions for WebSocket functionality
 */

import type { WebSocket } from "ws";

/**
 * Event types that can be broadcast to clients
 */
export type WSEventType =
  | "server:created"
  | "server:updated"
  | "server:deleted"
  | "server:status"
  | "server:stats"
  | "server:sync" // Periodic full server data sync (every 5s)
  | "node:updated"
  | "node:status"
  | "backup:created"
  | "backup:deleted"
  | "backup:status";

/**
 * WebSocket event structure
 */
export interface WSEvent {
  type: WSEventType;
  data: unknown;
  /** Optional: scope events to specific users */
  userId?: string;
  /** Optional: scope events to specific servers */
  serverId?: string;
}

/**
 * Connected client information
 */
export interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  authenticated: boolean;
  /** Servers the client is subscribed to */
  subscribedServers: Set<string>;
}
