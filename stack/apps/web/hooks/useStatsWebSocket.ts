"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ConsoleInfo, ServerStats } from "@/lib/api";

const MAX_HISTORY_LENGTH = 60; // Keep last 60 data points (1 minute at 1/sec)

export interface StatsWithHistory {
  current: ServerStats | null;
  cpuHistory: number[];
  memoryHistory: number[];
  memoryPercentHistory: number[];
  networkRxHistory: number[]; // Rate in bytes/sec
  networkTxHistory: number[]; // Rate in bytes/sec
  networkRxRate: number; // Current rate in bytes/sec
  networkTxRate: number; // Current rate in bytes/sec
  diskHistory: number[]; // Disk usage in bytes
  diskPercentHistory: number[]; // Disk usage as percentage
}

interface UseStatsWebSocketOptions {
  consoleInfo: ConsoleInfo | null;
  enabled?: boolean;
}

interface UseStatsWebSocketResult {
  stats: StatsWithHistory;
  isConnected: boolean;
}

/**
 * WebSocket hook for receiving stats from the Rust daemon
 *
 * The daemon sends stats through the console WebSocket with format:
 * { event: "stats", args: [{ memory_bytes, memory_limit_bytes, cpu_absolute, network: { rx_bytes, tx_bytes }, uptime }] }
 */
export function useStatsWebSocket({
  consoleInfo,
  enabled = true,
}: UseStatsWebSocketOptions): UseStatsWebSocketResult {
  const [isConnected, setIsConnected] = useState(false);
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

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track previous network bytes to calculate rate
  const prevNetworkRef = useRef<{ rx: number; tx: number; timestamp: number } | null>(null);

  const connect = useCallback(() => {
    if (!consoleInfo || !enabled) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Use the same WebSocket URL as console, append token
      const url = new URL(consoleInfo.websocketUrl);
      url.searchParams.set("token", consoleInfo.token);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        prevNetworkRef.current = null; // Reset on new connection
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
                break;

              case "stats": {
                const now = Date.now();

                // New daemon stats format
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

                setStats((prev) => {
                  const cpuPercent = newStats.cpu_absolute;
                  const memoryBytes = newStats.memory_bytes;
                  const memoryLimitBytes = newStats.memory_limit_bytes;
                  const memoryPercent = memoryLimitBytes > 0
                    ? (memoryBytes / memoryLimitBytes) * 100
                    : 0;

                  const networkRxTotal = newStats.network.rx_bytes;
                  const networkTxTotal = newStats.network.tx_bytes;

                  // Calculate disk usage
                  const diskBytes = newStats.disk_bytes;
                  const diskLimitBytes = newStats.disk_limit_bytes;
                  const diskPercent = diskLimitBytes > 0
                    ? (diskBytes / diskLimitBytes) * 100
                    : 0;

                  // Calculate network rate (bytes per second)
                  let rxRate = 0;
                  let txRate = 0;

                  if (prevNetworkRef.current) {
                    const timeDelta = (now - prevNetworkRef.current.timestamp) / 1000; // seconds
                    if (timeDelta > 0) {
                      const rxDelta = networkRxTotal - prevNetworkRef.current.rx;
                      const txDelta = networkTxTotal - prevNetworkRef.current.tx;

                      // Only calculate rate if values are increasing (not a reset)
                      if (rxDelta >= 0 && txDelta >= 0) {
                        rxRate = rxDelta / timeDelta;
                        txRate = txDelta / timeDelta;
                      }
                    }
                  }

                  // Update previous values
                  prevNetworkRef.current = { rx: networkRxTotal, tx: networkTxTotal, timestamp: now };

                  return {
                    current: newStats,
                    cpuHistory: [...prev.cpuHistory, cpuPercent].slice(-MAX_HISTORY_LENGTH),
                    memoryHistory: [...prev.memoryHistory, memoryBytes].slice(-MAX_HISTORY_LENGTH),
                    memoryPercentHistory: [...prev.memoryPercentHistory, memoryPercent].slice(-MAX_HISTORY_LENGTH),
                    networkRxHistory: [...prev.networkRxHistory, rxRate].slice(-MAX_HISTORY_LENGTH),
                    networkTxHistory: [...prev.networkTxHistory, txRate].slice(-MAX_HISTORY_LENGTH),
                    networkRxRate: rxRate,
                    networkTxRate: txRate,
                    diskHistory: [...prev.diskHistory, diskBytes].slice(-MAX_HISTORY_LENGTH),
                    diskPercentHistory: [...prev.diskPercentHistory, diskPercent].slice(-MAX_HISTORY_LENGTH),
                  };
                });
                break;
              }

              case "jwt error":
                console.error("Stats WebSocket JWT error:", data.message);
                break;

              // Ignore other events (console output, status, etc.)
              default:
                break;
            }
          }
        } catch (err) {
          console.error("Failed to parse stats message:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect after 3 seconds if still enabled
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("Stats WebSocket error:", error);
      };
    } catch (err) {
      console.error("Failed to create stats WebSocket:", err);
    }
  }, [consoleInfo, enabled]);

  useEffect(() => {
    if (enabled && consoleInfo) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled, consoleInfo]);

  // Reset stats when disabled
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
      setIsConnected(false);
      prevNetworkRef.current = null;
    }
  }, [enabled]);

  return { stats, isConnected };
}
