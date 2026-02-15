import type { CoreUsage } from "@stellarUI/components/DashboardCardsTypes/Types";

/**
 * Generate mock CPU/memory usage history data.
 *
 * @param length - Number of data points
 * @param base - Base value to oscillate around
 * @param variance - Maximum variance from base
 * @returns Array of percentage values
 */
const GenerateHistory = (length = 30, base = 45, variance = 20): number[] => {
  return Array.from({ length }, () =>
    Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance * 2))
  );
};

/**
 * Generate mock CPU core usage data.
 *
 * @param count - Number of cores
 * @returns Array of CoreUsage objects
 */
const GenerateCoreUsage = (count = 8): CoreUsage[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    percentage: Math.round(Math.random() * 100),
    frequency: 2400 + Math.round(Math.random() * 1200),
  }));
};

/**
 * Generate mock console lines.
 *
 * @param count - Number of lines to generate
 * @returns Array of console line objects
 */
const GenerateConsoleLines = (
  count = 20
): Array<{
  id: string;
  timestamp: number;
  level: "info" | "error" | "default";
  message: string;
}> => {
  const levels: Array<"info" | "error" | "default"> = ["info", "error", "default"];
  const messages = [
    "[Server] Starting Minecraft server...",
    "[Server] Loading world data...",
    "[Server] Preparing spawn area: 42%",
    '[Server] Done (3.241s)! For help, type "help"',
    "[INFO] Player Steve joined the game",
    "[INFO] Player Alex joined the game",
    "[WARN] Can't keep up! Is the server overloaded?",
    "[ERROR] Failed to save chunk at [12, -4]",
    "[Server] Saving world...",
    "[Server] World saved successfully",
    "[INFO] Player Steve left the game",
    "[Server] Running auto-backup...",
    "[Server] Backup complete: world_backup_001.zip",
    "[INFO] Loaded 42 plugins",
    "[WARN] Plugin 'ExamplePlugin' is outdated",
    "[Server] TPS: 19.8",
    "[INFO] Player Alex earned achievement [Getting Wood]",
    "[Server] Memory usage: 2048MB / 4096MB",
    "[INFO] Scheduled restart in 30 minutes",
    "[Server] Auto-save complete",
  ];

  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `line-${i}`,
    timestamp: now - (count - i) * 5000,
    level: levels[i % 3]!,
    message: messages[i % messages.length]!,
  }));
};

export { GenerateHistory, GenerateCoreUsage, GenerateConsoleLines };
