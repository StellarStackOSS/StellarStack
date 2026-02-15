"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ConsoleInfo, ServerStats } from "@/lib/Api";
import { StripAnsi } from "@/lib/AnsiUtils";
import { WEBSOCKET_CONSTANTS } from "@/lib/WebsocketConstants";
import {
  ProcessStatsUpdate,
  type StatsWithHistory as ProcessedStatsWithHistory,
} from "@/lib/StatsProcessor";

export interface ConsoleLine {
  text: string;
  type: "stdout" | "stderr" | "command" | "info" | "error";
  timestamp: Date;
}

// Re-export from stats-processor for convenience
export type StatsWithHistory = ProcessedStatsWithHistory;

interface UseServerWebSocketOptions {
  consoleInfo: ConsoleInfo | null;
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onStatusChange?: (state: string) => void;
}

interface UseServerWebSocketResult {
  // Console
  lines: ConsoleLine[];
  clearLines: () => void;
  sendCommand: (command: string) => void;
  sendPowerAction: (action: "start" | "stop" | "restart" | "kill") => void;

  // Stats
  stats: StatsWithHistory;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  reconnect: () => void;
}

/**
 * Combined WebSocket hook for console and stats from the Rust daemon.
 * Uses a single WebSocket connection for both console output and statistics.
 */
export const useServerWebSocket = ({
  consoleInfo,
  enabled = true,
  onConnect,
  onDisconnect,
  onStatusChange,
}: UseServerWebSocketOptions): UseServerWebSocketResult => {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [stats, setStats] = useState<StatsWithHistory>({
    current: null,
    cpuHistory: [],
    memoryHistory: [],
    memoryPercentHistory: [],
    networkRxHistory: [],
    networkTxHistory: [],
    networkRxRate: 0,
    networkTxRate: 0,
    diskHistory: [],
    diskPercentHistory: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const prevNetworkRef = useRef<{ rx: number; tx: number; timestamp: number } | null>(null);
  const connectingRef = useRef(false);
  const lastConnectionUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const addLine = useCallback((line: ConsoleLine) => {
    setLines((prev) => {
      const newLines = [...prev, line];
      if (newLines.length > WEBSOCKET_CONSTANTS.MAX_CONSOLE_LINES) {
        return newLines.slice(-WEBSOCKET_CONSTANTS.MAX_CONSOLE_LINES);
      }
      return newLines;
    });
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
  }, []);

  const connect = useCallback(() => {
    if (!consoleInfo || !enabled || !mountedRef.current) return;

    // Build URL to compare
    const url = new URL(consoleInfo.websocketUrl);
    url.searchParams.set("token", consoleInfo.token);
    const urlString = url.toString();

    // Prevent duplicate connections to the same URL
    if (connectingRef.current && lastConnectionUrlRef.current === urlString) {
      console.log("[WebSocket] Already connecting to same URL, skipping");
      return;
    }

    // If already connected to the same URL, skip
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      lastConnectionUrlRef.current === urlString
    ) {
      console.log("[WebSocket] Already connected to same URL, skipping");
      return;
    }

    // Close existing connection if different URL or not connected
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    connectingRef.current = true;
    lastConnectionUrlRef.current = urlString;
    setIsConnecting(true);

    try {
      const ws = new WebSocket(urlString);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        connectingRef.current = false;
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        prevNetworkRef.current = null;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.event && Array.isArray(message.args)) {
            const eventType = message.event;
            const data = message.args[0] || {};

            switch (eventType) {
              case "auth success":
                setIsConnected(true);
                onConnect?.();
                // Request recent logs on connection
                ws.send(JSON.stringify({ event: "send logs", args: [] }));
                break;

              case "console history":
                // Handle bulk log history (array of lines with timestamps)
                if (Array.isArray(data.lines)) {
                  const historyLines: ConsoleLine[] = data.lines
                    .map((entry: { line: string; timestamp: number }) => {
                      const text = StripAnsi(entry.line).replace(/\r?\n$/, "");
                      const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
                      return text.trim() ? { text, type: "stdout" as const, timestamp } : null;
                    })
                    .filter((line: ConsoleLine | null): line is ConsoleLine => line !== null);

                  if (historyLines.length > 0) {
                    setLines((prev) => {
                      // Prepend history, keeping total under max
                      const combined = [...historyLines, ...prev];
                      return combined.slice(-WEBSOCKET_CONSTANTS.MAX_CONSOLE_LINES);
                    });
                  }
                }
                break;

              case "jwt error":
                addLine({
                  text: `Authentication error: ${data.message || "Invalid token"}`,
                  type: "error",
                  timestamp: new Date(),
                });
                break;

              case "error":
                addLine({
                  text: data.message || "Unknown error",
                  type: "error",
                  timestamp: new Date(),
                });
                break;

              case "status":
                if (data.state) {
                  onStatusChange?.(data.state);
                  // Clear console only when server is fully offline
                  if (data.state === "offline") {
                    setLines([]);
                  }
                }
                break;

              case "console output":
                if (data.line) {
                  let text = StripAnsi(data.line).replace(/\r?\n$/, "");
                  if (text.trim()) {
                    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
                    addLine({ text, type: "stdout", timestamp });
                  }
                }
                break;

              case "install output":
                if (data.line) {
                  let text = StripAnsi(data.line).replace(/\r?\n$/, "");
                  if (text.trim()) {
                    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
                    addLine({ text: `[install] ${text}`, type: "stdout", timestamp });
                  }
                }
                break;

              case "install started":
                addLine({ text: "Installation started...", type: "info", timestamp: new Date() });
                break;

              case "install completed":
                addLine({
                  text: data.successful
                    ? "Installation completed successfully"
                    : "Installation failed",
                  type: data.successful ? "info" : "error",
                  timestamp: new Date(),
                });
                break;

              case "stats": {
                const now = Date.now();
                const newStats: ServerStats = {
                  memory_bytes: data.memory_bytes ?? 0,
                  memory_limit_bytes: data.memory_limit_bytes ?? 0,
                  cpu_absolute: data.cpu_absolute ?? 0,
                  network: {
                    rx_bytes: data.network?.rx_bytes ?? 0,
                    tx_bytes: data.network?.tx_bytes ?? 0,
                  },
                  uptime: data.uptime ?? 0,
                  state: data.state ?? "unknown",
                  disk_bytes: data.disk_bytes ?? 0,
                  disk_limit_bytes: data.disk_limit_bytes ?? 0,
                };

                // Initialize prevNetworkRef on first stats message if not already set
                if (!prevNetworkRef.current) {
                  prevNetworkRef.current = {
                    rx: newStats.network.rx_bytes,
                    tx: newStats.network.tx_bytes,
                    timestamp: now,
                  };
                }

                setStats((prev) => {
                  const now = Date.now();
                  const updatedStats = ProcessStatsUpdate({
                    newStats,
                    prevStats: prev,
                    prevNetworkRef: prevNetworkRef.current,
                    now,
                    maxHistoryLength: WEBSOCKET_CONSTANTS.MAX_HISTORY_LENGTH,
                  });

                  // Update prevNetworkRef for next calculation
                  prevNetworkRef.current = {
                    rx: newStats.network.rx_bytes,
                    tx: newStats.network.tx_bytes,
                    timestamp: now,
                  };

                  return updatedStats;
                });
                break;
              }

              default:
                break;
            }
          }
        } catch {
          if (event.data) {
            addLine({ text: StripAnsi(event.data), type: "stdout", timestamp: new Date() });
          }
        }
      };

      ws.onclose = () => {
        connectingRef.current = false;
        wsRef.current = null;

        // Only update state if component is still mounted
        if (!mountedRef.current) return;

        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        // Attempt reconnection only if still mounted and enabled
        if (
          mountedRef.current &&
          enabled &&
          reconnectAttemptsRef.current < WEBSOCKET_CONSTANTS.MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = () => {
        connectingRef.current = false;
        if (mountedRef.current) {
          setIsConnecting(false);
        }
      };
    } catch (err) {
      connectingRef.current = false;
      if (mountedRef.current) {
        setIsConnecting(false);
      }
      console.error("WebSocket connection failed:", err);
    }
  }, [consoleInfo, enabled, addLine, onConnect, onDisconnect, onStatusChange]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = WEBSOCKET_CONSTANTS.MAX_RECONNECT_ATTEMPTS;
    connectingRef.current = false;
    lastConnectionUrlRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    connect();
  }, [connect, disconnect]);

  const sendCommand = useCallback((command: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({ event: "send command", args: [command] }));
    } catch (err) {
      console.error("Failed to send command:", err);
    }
  }, []);

  const sendPowerAction = useCallback((action: "start" | "stop" | "restart" | "kill") => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({ event: "set state", args: [action] }));
    } catch (err) {
      console.error("Failed to send power action:", err);
    }
  }, []);

  // Connect when consoleInfo becomes available
  useEffect(() => {
    mountedRef.current = true;

    if (consoleInfo && enabled) {
      connect();
    }

    return () => {
      // Mark as unmounted first to prevent any state updates
      mountedRef.current = false;

      // Clear any pending reconnect timers
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close the WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Reset connection state
      connectingRef.current = false;
      lastConnectionUrlRef.current = null;
      reconnectAttemptsRef.current = WEBSOCKET_CONSTANTS.MAX_RECONNECT_ATTEMPTS; // Prevent reconnection attempts
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect is stable via refs, we only want to reconnect on URL/token/enabled changes
  }, [consoleInfo?.websocketUrl, consoleInfo?.token, enabled]);

  // Reset state when disabled
  useEffect(() => {
    if (!enabled) {
      setStats({
        current: null,
        cpuHistory: [],
        memoryHistory: [],
        memoryPercentHistory: [],
        networkRxHistory: [],
        networkTxHistory: [],
        networkRxRate: 0,
        networkTxRate: 0,
        diskHistory: [],
        diskPercentHistory: [],
      });
      prevNetworkRef.current = null;
    }
  }, [enabled]);

  return {
    lines,
    clearLines,
    sendCommand,
    sendPowerAction,
    stats,
    isConnected,
    isConnecting,
    reconnect,
  };
};
