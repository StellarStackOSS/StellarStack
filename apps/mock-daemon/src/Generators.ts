/**
 * Fake data generators for the mock daemon.
 * Produces randomized but realistic system stats, file listings, and log lines.
 */

import type { HardwareStats, SystemInfo, WsStats, FileInfo, MockFile } from "./Types.js";

/** Total memory in bytes (16 GB) */
const TOTAL_MEMORY = 16 * 1024 * 1024 * 1024;

/** Total disk in bytes (500 GB) */
const TOTAL_DISK = 500 * 1024 * 1024 * 1024;

/**
 * Generates a random number between min and max (inclusive).
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random number in range
 */
const RandomBetween = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Generates a random float between min and max.
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random float in range
 */
const RandomFloat = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

/**
 * Generates static system information.
 *
 * @param serverCount - Number of active servers
 * @returns SystemInfo response
 */
const GenerateSystemInfo = (serverCount: number): SystemInfo => ({
  version: "0.1.0-mock",
  architecture: "x86_64",
  cpu_count: 4,
  kernel_version: "6.1.0-mock",
  os: "Linux",
  server_count: serverCount,
});

/**
 * Generates randomized hardware statistics.
 *
 * @returns HardwareStats response
 */
const GenerateHardwareStats = (): HardwareStats => {
  const memUsed = RandomBetween(2 * 1024 * 1024 * 1024, 12 * 1024 * 1024 * 1024);
  const diskUsed = RandomBetween(50 * 1024 * 1024 * 1024, 350 * 1024 * 1024 * 1024);

  return {
    cpu: {
      cores: 4,
      usage_percent: RandomFloat(5, 85),
      load_avg: {
        one: RandomFloat(0.1, 4.0),
        five: RandomFloat(0.1, 3.0),
        fifteen: RandomFloat(0.1, 2.5),
      },
    },
    memory: {
      total: TOTAL_MEMORY,
      used: memUsed,
      available: TOTAL_MEMORY - memUsed,
      usage_percent: (memUsed / TOTAL_MEMORY) * 100,
    },
    disk: {
      total: TOTAL_DISK,
      used: diskUsed,
      available: TOTAL_DISK - diskUsed,
      usage_percent: (diskUsed / TOTAL_DISK) * 100,
    },
    uptime: RandomBetween(3600, 864000),
    hostname: "mock-daemon-host",
    os: {
      name: "Ubuntu",
      version: "22.04",
      arch: "x86_64",
    },
  };
};

/**
 * Generates WebSocket stats for a running server.
 *
 * @param memoryLimit - Server memory limit in bytes
 * @param startedAt - Server start timestamp (seconds)
 * @returns WsStats payload
 */
const GenerateWsStats = (memoryLimit: number, startedAt: number): WsStats => {
  const memUsed = RandomBetween(100 * 1024 * 1024, Math.min(memoryLimit, 2 * 1024 * 1024 * 1024));
  const diskUsed = RandomBetween(50 * 1024 * 1024, 5 * 1024 * 1024 * 1024);
  const uptime = Math.floor(Date.now() / 1000) - startedAt;

  return {
    memory_bytes: memUsed,
    memory_limit_bytes: memoryLimit,
    cpu_absolute: RandomFloat(0.5, 95.0),
    network: {
      rx_bytes: RandomBetween(1024 * 1024, 500 * 1024 * 1024),
      tx_bytes: RandomBetween(1024 * 1024, 300 * 1024 * 1024),
    },
    uptime,
    disk_bytes: diskUsed,
    disk_limit_bytes: 10 * 1024 * 1024 * 1024,
  };
};

/** Fake log line templates */
const LOG_TEMPLATES = [
  "[INFO] Preparing spawn for server...",
  "[INFO] Server thread running",
  "[INFO] Loading libraries, please wait...",
  "[INFO] Starting minecraft server version 1.21.4",
  '[INFO] Preparing level "world"',
  "[INFO] Preparing start region for dimension minecraft:overworld",
  '[INFO] Done! For help, type "help"',
  "[INFO] Player connected from /127.0.0.1",
  "[INFO] UUID of player MockPlayer is 550e8400-e29b-41d4-a716-446655440000",
  "[WARN] Can't keep up! Is the server overloaded?",
  "[INFO] Saving the game (this may take a moment!)",
  "[INFO] Saved the game",
  "[INFO] ThreadedAnvilChunkStorage: All dimensions are saved",
  "[INFO] Tick rate: 20.0 tps",
  "[INFO] Memory usage: 512MB / 2048MB",
];

/**
 * Generates a random fake log line.
 *
 * @returns A console output line string
 */
const GenerateLogLine = (): string => {
  const template = LOG_TEMPLATES[RandomBetween(0, LOG_TEMPLATES.length - 1)];
  return template ?? "[INFO] Server running...";
};

/**
 * Converts a MockFile to a FileInfo response object.
 *
 * @param file - In-memory file data
 * @returns FileInfo for API response
 */
const MockFileToFileInfo = (file: MockFile): FileInfo => ({
  name: file.name,
  size: file.size,
  is_directory: file.is_directory,
  is_file: !file.is_directory,
  is_symlink: false,
  modified: file.modified,
  created: file.created,
  mode: file.mode,
  mime_type: file.is_directory ? "inode/directory" : GuessMimeType(file.name),
});

/**
 * Guesses the MIME type based on file extension.
 *
 * @param name - File name
 * @returns MIME type string
 */
const GuessMimeType = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase();
  const MIME_MAP: Record<string, string> = {
    txt: "text/plain",
    log: "text/plain",
    json: "application/json",
    yml: "text/yaml",
    yaml: "text/yaml",
    properties: "text/x-java-properties",
    jar: "application/java-archive",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    png: "image/png",
    jpg: "image/jpeg",
    toml: "text/x-toml",
    cfg: "text/plain",
    ini: "text/plain",
    sh: "application/x-sh",
    bat: "application/x-msdos-program",
  };
  return MIME_MAP[ext ?? ""] ?? "application/octet-stream";
};

/**
 * Generates a random UUID v4.
 *
 * @returns UUID string
 */
const GenerateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generates a random SHA-256-like checksum string.
 *
 * @returns Hex checksum string
 */
const GenerateChecksum = (): string => {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
};

export {
  RandomBetween,
  RandomFloat,
  GenerateSystemInfo,
  GenerateHardwareStats,
  GenerateWsStats,
  GenerateLogLine,
  MockFileToFileInfo,
  GuessMimeType,
  GenerateUUID,
  GenerateChecksum,
};
