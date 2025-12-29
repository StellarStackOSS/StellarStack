import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serverKeys } from "./queries/use-servers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Convert HTTP URL to WebSocket URL
function getWebSocketUrl(): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/ws";
  return url.toString();
}

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
  | "backup:status"
  | "pong";

interface WSEvent {
  type: WSEventType;
  data: unknown;
  serverId?: string;
  userId?: string;
}

interface UseWebSocketOptions {
  // Server IDs to subscribe to for targeted updates
  serverIds?: string[];
  // Whether to automatically reconnect on disconnect
  autoReconnect?: boolean;
  // Reconnection delay in ms
  reconnectDelay?: number;
  // Enable/disable the WebSocket connection
  enabled?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    serverIds = [],
    autoReconnect = true,
    reconnectDelay = 3000,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSEvent | null>(null);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        setLastMessage(data);

        switch (data.type) {
          case "server:created":
            // Invalidate server list
            queryClient.invalidateQueries({ queryKey: serverKeys.list() });
            break;

          case "server:updated":
            // Update specific server in cache
            if (data.serverId) {
              queryClient.invalidateQueries({
                queryKey: serverKeys.detail(data.serverId),
              });
            }
            // Also invalidate list for status updates
            queryClient.invalidateQueries({ queryKey: serverKeys.list() });
            break;

          case "server:deleted":
            // Remove from cache and invalidate list
            if (data.data && typeof data.data === "object" && "id" in data.data) {
              const deletedId = (data.data as { id: string }).id;
              queryClient.removeQueries({
                queryKey: serverKeys.detail(deletedId),
              });
            }
            queryClient.invalidateQueries({ queryKey: serverKeys.list() });
            break;

          case "server:status":
            // Update server status in cache
            if (data.serverId) {
              queryClient.invalidateQueries({
                queryKey: serverKeys.detail(data.serverId),
              });
            }
            queryClient.invalidateQueries({ queryKey: serverKeys.list() });
            break;

          case "server:stats":
            // Stats updates can be handled by specific components
            break;

          case "node:updated":
          case "node:status":
            // Invalidate nodes queries
            queryClient.invalidateQueries({ queryKey: ["nodes"] });
            break;

          case "backup:created":
          case "backup:deleted":
          case "backup:status":
            // Invalidate backup queries for the server
            if (data.serverId) {
              queryClient.invalidateQueries({
                queryKey: ["backups", data.serverId],
              });
            }
            break;

          case "pong":
            // Heartbeat response, connection is alive
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    },
    [queryClient]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(getWebSocketUrl());

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);

        // Subscribe to server updates
        serverIds.forEach((serverId) => {
          ws.send(JSON.stringify({ type: "subscribe", serverId }));
        });
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect
        if (autoReconnect && enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
    }
  }, [serverIds, autoReconnect, reconnectDelay, enabled, handleMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Subscribe to a server
  const subscribe = useCallback((serverId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", serverId }));
    }
  }, []);

  // Unsubscribe from a server
  const unsubscribe = useCallback((serverId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", serverId }));
    }
  }, []);

  // Send ping to keep connection alive
  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]); // Only re-run if enabled changes

  // Update subscriptions when serverIds change
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      serverIds.forEach((serverId) => {
        subscribe(serverId);
      });
    }
  }, [serverIds, subscribe]);

  // Ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      ping();
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, ping]);

  return {
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    ping,
  };
}

// Hook for subscribing to a single server's updates
export function useServerWebSocket(serverId: string | undefined) {
  return useWebSocket({
    serverIds: serverId ? [serverId] : [],
    enabled: !!serverId,
  });
}

// Global WebSocket hook for the app
export function useGlobalWebSocket() {
  return useWebSocket({
    enabled: true,
  });
}
