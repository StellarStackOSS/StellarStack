/**
 * Static mock data for all 3 showcase demos (Overview, Files, Schedules).
 * No backend required — these power the animated landing page demos.
 */

// ─── Overview Demo Data ─────────────────────────────────────────────────────

/** Historical CPU usage data points for sparkline */
export const CPU_HISTORY: number[] = [
  32, 35, 38, 42, 40, 45, 48, 52, 50, 47,
  44, 46, 50, 53, 48, 45, 42, 44, 47, 45,
];

/** Historical RAM usage data points for sparkline */
export const RAM_HISTORY: number[] = [
  58, 60, 62, 65, 63, 64, 66, 68, 67, 65,
  63, 64, 66, 68, 70, 69, 67, 65, 66, 68,
];

/** Historical network download data points (MB/s) */
export const NETWORK_DOWNLOAD_HISTORY: number[] = [
  8.2, 9.1, 10.5, 12.3, 11.8, 10.2, 9.5, 11.0, 12.8, 13.5,
  12.0, 10.8, 11.5, 13.2, 14.0, 12.5, 11.0, 10.5, 12.0, 11.5,
];

/** Historical network upload data points (MB/s) */
export const NETWORK_UPLOAD_HISTORY: number[] = [
  3.1, 3.5, 4.2, 4.8, 4.5, 3.8, 3.2, 4.0, 4.5, 5.0,
  4.2, 3.8, 4.1, 4.8, 5.2, 4.5, 3.9, 3.5, 4.0, 3.8,
];

/**
 * Console log entries for the overview demo.
 */
interface MockConsoleLine {
  /** Unique identifier */
  id: string;
  /** Milliseconds since epoch */
  timestamp: number;
  /** Log level */
  level: "info" | "error" | "default";
  /** Log message text */
  message: string;
}

const BASE_TIMESTAMP = Date.now() - 120000;

export const CONSOLE_LINES: MockConsoleLine[] = [
  {
    id: "log-1",
    timestamp: BASE_TIMESTAMP,
    level: "default",
    message: "[Server] Starting minecraft server version 1.21.4",
  },
  {
    id: "log-2",
    timestamp: BASE_TIMESTAMP + 5000,
    level: "info",
    message: "[Server] Loading properties...",
  },
  {
    id: "log-3",
    timestamp: BASE_TIMESTAMP + 12000,
    level: "info",
    message: "[Server] Preparing spawn area: 92%",
  },
  {
    id: "log-4",
    timestamp: BASE_TIMESTAMP + 18000,
    level: "info",
    message: '[Server] Done (12.4s)! For help, type "help"',
  },
  {
    id: "log-5",
    timestamp: BASE_TIMESTAMP + 60000,
    level: "info",
    message: "[Server] Player Steve joined the game",
  },
];

// ─── Files Demo Data ────────────────────────────────────────────────────────

/**
 * Represents a file entry in the mock file browser.
 */
export interface MockFileItem {
  /** Unique identifier */
  id: string;
  /** File or folder name */
  name: string;
  /** Entry type */
  type: "folder" | "file";
  /** Formatted size string */
  size: string;
  /** Formatted modification date */
  modified: string;
}

export const MOCK_FILES: MockFileItem[] = [
  { id: "1", name: "server.properties", type: "file", size: "1.2 KB", modified: "Feb 5, 2026" },
  { id: "2", name: "world", type: "folder", size: "--", modified: "Feb 5, 2026" },
  { id: "3", name: "plugins", type: "folder", size: "--", modified: "Feb 4, 2026" },
  { id: "4", name: "server.jar", type: "file", size: "42.8 MB", modified: "Feb 1, 2026" },
  { id: "5", name: "banned-players.json", type: "file", size: "256 B", modified: "Jan 28, 2026" },
  { id: "6", name: "whitelist.json", type: "file", size: "512 B", modified: "Jan 28, 2026" },
];

/**
 * Folder preview data for FilledFolder components.
 */
export interface MockFolderPreview {
  /** Folder display name */
  name: string;
  /** Number of files in the folder */
  fileCount: number;
}

export const MOCK_FOLDERS: MockFolderPreview[] = [
  { name: "world", fileCount: 24 },
  { name: "plugins", fileCount: 8 },
  { name: "logs", fileCount: 156 },
  { name: "backups", fileCount: 12 },
];

/** Mock storage usage values */
export const STORAGE_USED_GB = 18.4;
export const STORAGE_TOTAL_GB = 50.0;

// ─── Schedules Demo Data ────────────────────────────────────────────────────

/**
 * Represents a task within a schedule.
 */
export interface MockScheduleTask {
  /** Task identifier */
  id: string;
  /** Action type */
  action: "power_start" | "power_stop" | "power_restart" | "backup" | "command";
  /** Command payload (for command action) */
  payload?: string;
  /** Order in the chain */
  sequence: number;
  /** Seconds delay before execution */
  timeOffset: number;
  /** How the task is triggered */
  triggerMode: "TIME_DELAY" | "ON_COMPLETION";
}

/**
 * Represents a schedule with its tasks.
 */
export interface MockSchedule {
  /** Schedule identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable cron description */
  cronDescription: string;
  /** Whether the schedule is active */
  isActive: boolean;
  /** Index of the currently executing task (null if not running) */
  executingTaskIndex?: number | null;
  /** Tasks in execution order */
  tasks: MockScheduleTask[];
}

export const MOCK_SCHEDULES: MockSchedule[] = [
  {
    id: "sched-1",
    name: "Daily Maintenance",
    cronDescription: "Every day @ 4:00 AM",
    isActive: true,
    executingTaskIndex: 1,
    tasks: [
      {
        id: "task-1a",
        action: "command",
        payload: "save-all",
        sequence: 1,
        timeOffset: 0,
        triggerMode: "TIME_DELAY",
      },
      {
        id: "task-1b",
        action: "backup",
        sequence: 2,
        timeOffset: 5,
        triggerMode: "ON_COMPLETION",
      },
      {
        id: "task-1c",
        action: "power_restart",
        sequence: 3,
        timeOffset: 10,
        triggerMode: "TIME_DELAY",
      },
    ],
  },
  {
    id: "sched-2",
    name: "Hourly Backup",
    cronDescription: "Every hour @ :00",
    isActive: false,
    tasks: [
      {
        id: "task-2a",
        action: "backup",
        sequence: 1,
        timeOffset: 0,
        triggerMode: "TIME_DELAY",
      },
    ],
  },
];
