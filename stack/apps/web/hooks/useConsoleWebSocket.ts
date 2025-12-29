"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ConsoleInfo } from "@/lib/api";

export interface ConsoleLine {
  text: string;
  type: "stdout" | "stderr" | "command" | "info" | "error";
  timestamp: Date;
}

// Strip ANSI escape codes from text (common in Pterodactyl egg output)
const stripAnsi = (text: string): string => {
  // Matches ANSI escape codes including:
  // - Color codes: \x1b[31m, \x1b[0m, etc.
  // - Control codes: \x1b[2J (clear screen), \x1b[H (cursor home), etc.
  // - Extended codes: \x1b[38;2;r;g;bm (24-bit color), \x1b[38;5;nm (256 color)
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07|\x1b\(B|\x1b\[\?.*?[hl]|\r/g, "");
};

interface UseConsoleWebSocketOptions {
  consoleInfo: ConsoleInfo | null;
  enabled?: boolean;
  maxLines?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onStatusChange?: (state: string) => void;
}

interface UseConsoleWebSocketResult {
  lines: ConsoleLine[];
  isConnected: boolean;
  isConnecting: boolean;
  sendCommand: (command: string) => void;
  sendPowerAction: (action: "start" | "stop" | "restart" | "kill") => void;
  clearLines: () => void;
  reconnect: () => void;
}

/**
 * WebSocket hook for connecting to the Rust daemon console
 *
 * The daemon sends messages in format: { event: "...", args: [...] }
 * Events:
 * - "auth success" - Authentication successful
 * - "status" - Server state change: { state: "running" | "offline" | ... }
 * - "console output" - Console line: { line: "..." }
 * - "install output" - Install line: { line: "..." }
 * - "stats" - Statistics update
 * - "jwt error" - Authentication error
 * - "error" - General error
 */
export const useConsoleWebSocket = ({
  consoleInfo,
  enabled = true,
  maxLines = 500,
  onConnect,
  onDisconnect,
  onError,
  onStatusChange,
}: UseConsoleWebSocketOptions): UseConsoleWebSocketResult => {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const addLine = useCallback((line: ConsoleLine) => {
    setLines((prev) => {
      const newLines = [...prev, line];
      // Keep only the last maxLines
      if (newLines.length > maxLines) {
        return newLines.slice(-maxLines);
      }
      return newLines;
    });
  }, [maxLines]);

  const clearLines = useCallback(() => {
    setLines([]);
  }, []);

  const connect = useCallback(() => {
    console.log("[WebSocket] connect() called, consoleInfo:", consoleInfo, "enabled:", enabled);

    if (!consoleInfo || !enabled) {
      console.log("[WebSocket] Aborting connect - missing consoleInfo or not enabled");
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      console.log("[WebSocket] Closing existing connection");
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);

    try {
      // Append token to WebSocket URL
      const url = new URL(consoleInfo.websocketUrl);
      url.searchParams.set("token", consoleInfo.token);

      console.log("[WebSocket] Creating WebSocket connection to:", url.toString());
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        // Don't set connected until we receive auth success
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle daemon message format: { event: "...", args: [...] }
          if (message.event && Array.isArray(message.args)) {
            const eventType = message.event;
            const data = message.args[0] || {};

            switch (eventType) {
              case "auth success":
                setIsConnected(true);
                addLine({
                  text: "Connected to console",
                  type: "info",
                  timestamp: new Date(),
                });
                onConnect?.();
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
                  addLine({
                    text: `Server status: ${data.state}`,
                    type: "info",
                    timestamp: new Date(),
                  });
                  onStatusChange?.(data.state);
                }
                break;

              case "console output":
                if (data.line) {
                  let text = stripAnsi(data.line);
                  // Remove trailing newlines
                  text = text.replace(/\r?\n$/, "");
                  if (text.trim()) {
                    addLine({
                      text,
                      type: "stdout",
                      timestamp: new Date(),
                    });
                  }
                }
                break;

              case "install output":
                if (data.line) {
                  let text = stripAnsi(data.line);
                  text = text.replace(/\r?\n$/, "");
                  if (text.trim()) {
                    addLine({
                      text: `[install] ${text}`,
                      type: "stdout",
                      timestamp: new Date(),
                    });
                  }
                }
                break;

              case "install started":
                addLine({
                  text: "Installation started...",
                  type: "info",
                  timestamp: new Date(),
                });
                break;

              case "install completed":
                addLine({
                  text: data.successful ? "Installation completed successfully" : "Installation failed",
                  type: data.successful ? "info" : "error",
                  timestamp: new Date(),
                });
                break;

              default:
                // Unknown event - log for debugging
                console.log("Unknown WebSocket event:", eventType, data);
            }
          }
          // Legacy format support: { type: "log", data: { ... } }
          else if (message.type === "log" && message.data) {
            const logData = message.data;
            const msgType = (logData.type || "stdout").toLowerCase();
            let text = logData.data || "";
            text = stripAnsi(text);
            text = text.replace(/\r?\n$/, "");

            if (text.trim()) {
              addLine({
                text,
                type: msgType === "stderr" ? "stderr" : "stdout",
                timestamp: logData.timestamp ? new Date(logData.timestamp) : new Date(),
              });
            }
          }
        } catch {
          // Plain text message
          if (event.data) {
            addLine({
              text: stripAnsi(event.data),
              type: "stdout",
              timestamp: new Date(),
            });
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        addLine({
          text: "Disconnected from console",
          type: "info",
          timestamp: new Date(),
        });
        onDisconnect?.();

        // Attempt reconnection
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            addLine({
              text: `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
              type: "info",
              timestamp: new Date(),
            });
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        setIsConnecting(false);
        addLine({
          text: "Connection error",
          type: "error",
          timestamp: new Date(),
        });
        onError?.(error);
      };
    } catch (err) {
      setIsConnecting(false);
      addLine({
        text: `Failed to connect: ${err}`,
        type: "error",
        timestamp: new Date(),
      });
    }
  }, [consoleInfo, enabled, addLine, onConnect, onDisconnect, onError, onStatusChange]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
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
      addLine({
        text: "Not connected to console",
        type: "error",
        timestamp: new Date(),
      });
      return;
    }

    try {
      // Send command to daemon in Wings format: { event: "send command", args: ["command"] }
      wsRef.current.send(JSON.stringify({
        event: "send command",
        args: [command],
      }));
    } catch (err) {
      addLine({
        text: `Failed to send command: ${err}`,
        type: "error",
        timestamp: new Date(),
      });
    }
  }, [addLine]);

  const sendPowerAction = useCallback((action: "start" | "stop" | "restart" | "kill") => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLine({
        text: "Not connected to console",
        type: "error",
        timestamp: new Date(),
      });
      return;
    }

    try {
      // Send power action to daemon: { event: "set state", args: ["start"] }
      wsRef.current.send(JSON.stringify({
        event: "set state",
        args: [action],
      }));
    } catch (err) {
      addLine({
        text: `Failed to send power action: ${err}`,
        type: "error",
        timestamp: new Date(),
      });
    }
  }, [addLine]);

  // Connect when consoleInfo becomes available
  useEffect(() => {
    if (consoleInfo && enabled) {
      console.log("[WebSocket] Connecting to:", consoleInfo.websocketUrl);
      connect();
    } else {
      console.log("[WebSocket] Not connecting - consoleInfo:", !!consoleInfo, "enabled:", enabled);
    }

    return () => {
      disconnect();
    };
  }, [consoleInfo, enabled, connect, disconnect]);

  return {
    lines,
    isConnected,
    isConnecting,
    sendCommand,
    sendPowerAction,
    clearLines,
    reconnect,
  };
};
