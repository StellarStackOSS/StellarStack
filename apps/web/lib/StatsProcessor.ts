import type { ServerStats } from "@/lib/Api";

export interface StatsWithHistory {
  current: ServerStats | null;
  cpuHistory: number[];
  memoryHistory: number[];
  memoryPercentHistory: number[];
  networkRxHistory: number[];
  networkTxHistory: number[];
  networkRxRate: number;
  networkTxRate: number;
  diskHistory: number[];
  diskPercentHistory: number[];
}

interface ProcessStatsInput {
  newStats: ServerStats;
  prevStats: StatsWithHistory;
  prevNetworkRef: { rx: number; tx: number; timestamp: number } | null;
  now: number;
  maxHistoryLength: number;
}

// Process server stats update and return new state with history
export const ProcessStatsUpdate = ({
  newStats,
  prevStats,
  prevNetworkRef,
  now,
  maxHistoryLength,
}: ProcessStatsInput): StatsWithHistory => {
  const cpuPercent = newStats.cpu_absolute;
  const memoryBytes = newStats.memory_bytes;
  const memoryLimitBytes = newStats.memory_limit_bytes;
  const memoryPercent = memoryLimitBytes > 0 ? (memoryBytes / memoryLimitBytes) * 100 : 0;

  const networkRxTotal = newStats.network.rx_bytes;
  const networkTxTotal = newStats.network.tx_bytes;

  // Disk usage
  const diskBytes = newStats.disk_bytes;
  const diskLimitBytes = newStats.disk_limit_bytes;
  const diskPercent = diskLimitBytes > 0 ? (diskBytes / diskLimitBytes) * 100 : 0;

  let rxRate = 0;
  let txRate = 0;

  if (prevNetworkRef) {
    const timeDelta = (now - prevNetworkRef.timestamp) / 1000;
    if (timeDelta > 0) {
      const rxDelta = networkRxTotal - prevNetworkRef.rx;
      const txDelta = networkTxTotal - prevNetworkRef.tx;
      if (rxDelta >= 0 && txDelta >= 0) {
        rxRate = rxDelta / timeDelta;
        txRate = txDelta / timeDelta;
      }
    }
  }

  return {
    current: newStats,
    cpuHistory: [...prevStats.cpuHistory, cpuPercent].slice(-maxHistoryLength),
    memoryHistory: [...prevStats.memoryHistory, memoryBytes].slice(-maxHistoryLength),
    memoryPercentHistory: [...prevStats.memoryPercentHistory, memoryPercent].slice(
      -maxHistoryLength
    ),
    networkRxHistory: [...prevStats.networkRxHistory, rxRate].slice(-maxHistoryLength),
    networkTxHistory: [...prevStats.networkTxHistory, txRate].slice(-maxHistoryLength),
    networkRxRate: rxRate,
    networkTxRate: txRate,
    diskHistory: [...prevStats.diskHistory, diskBytes].slice(-maxHistoryLength),
    diskPercentHistory: [...prevStats.diskPercentHistory, diskPercent].slice(-maxHistoryLength),
  };
};
