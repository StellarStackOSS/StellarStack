import { Command, CommandContext } from "./types";
import { servers } from "@/lib/api";
import { Power, StopCircle, RotateCcw, Zap, Lock, Clock, Upload } from "lucide-react";

/**
 * Check if server is currently running
 * @param ctx Command context
 */
const isServerRunning = (ctx: CommandContext) => ctx.server?.status === "running";

/**
 * Check if server is currently stopped
 * @param ctx Command context
 */
const isServerStopped = (ctx: CommandContext) => ctx.server?.status === "stopped";

/**
 * Check if user can control the current server
 * @param ctx Command context
 */
const canControlServer = (ctx: CommandContext) => !!ctx.serverId;

/**
 * Server action commands for power controls and management
 * Includes start, stop, restart, kill, and management operations
 */
export const serverActionCommands: Command[] = [
  // Power Controls
  {
    id: "action-server-start",
    label: "Start Server",
    description: "Start the server",
    icon: <Power className="size-4" />,
    category: "server-power",
    type: "simple",
    shortcut: ["s", "s"],
    isAvailable: (ctx: CommandContext) => canControlServer(ctx) && isServerStopped(ctx),
    action: {
      apiCall: {
        handler: async (ctx: CommandContext) => {
          if (ctx.serverId) {
            await servers.start(ctx.serverId);
          }
        },
      },
    },
    keywords: ["start", "power", "on"],
    priority: 90,
  },
  {
    id: "action-server-stop",
    label: "Stop Server",
    description: "Stop the server gracefully",
    icon: <StopCircle className="size-4" />,
    category: "server-power",
    type: "simple",
    shortcut: ["s", "x"],
    isAvailable: (ctx: CommandContext) => canControlServer(ctx) && isServerRunning(ctx),
    action: {
      apiCall: {
        handler: async (ctx: CommandContext) => {
          if (ctx.serverId) {
            await servers.stop(ctx.serverId);
          }
        },
        confirmation: {
          title: "Stop Server",
          description: "Are you sure you want to stop this server?",
        },
      },
    },
    keywords: ["stop", "power", "off"],
    priority: 89,
  },
  {
    id: "action-server-restart",
    label: "Restart Server",
    description: "Restart the server",
    icon: <RotateCcw className="size-4" />,
    category: "server-power",
    type: "simple",
    shortcut: ["s", "r"],
    isAvailable: (ctx: CommandContext) => canControlServer(ctx) && isServerRunning(ctx),
    action: {
      apiCall: {
        handler: async (ctx: CommandContext) => {
          if (ctx.serverId) {
            await servers.restart(ctx.serverId);
          }
        },
      },
    },
    keywords: ["restart", "reboot"],
    priority: 88,
  },
  {
    id: "action-server-kill",
    label: "Force Kill Server",
    description: "Forcefully kill the server",
    icon: <Zap className="size-4" />,
    category: "server-power",
    type: "simple",
    isAvailable: (ctx: CommandContext) => canControlServer(ctx) && isServerRunning(ctx),
    action: {
      apiCall: {
        handler: async (ctx: CommandContext) => {
          if (ctx.serverId) {
            await servers.kill(ctx.serverId);
          }
        },
        confirmation: {
          title: "Force Kill Server",
          description: "This will forcefully terminate the server. Data may be lost.",
        },
      },
    },
    keywords: ["kill", "force", "stop"],
    priority: 87,
  },

  // Server Management
  {
    id: "action-create-backup",
    label: "Create Backup",
    description: "Create a new backup",
    icon: <Lock className="size-4" />,
    category: "server-management",
    type: "form",
    shortcut: ["b", "c"],
    isAvailable: (ctx: CommandContext) => canControlServer(ctx),
    action: {
      openForm: (ctx: CommandContext) => {
        // This will be handled by the UI
      },
    },
    keywords: ["backup", "save", "snapshot"],
    priority: 80,
  },
  {
    id: "action-create-schedule",
    label: "Create Schedule",
    description: "Create a new automated schedule",
    icon: <Clock className="size-4" />,
    category: "server-management",
    type: "form",
    isAvailable: (ctx: CommandContext) => canControlServer(ctx),
    action: {
      openForm: (ctx: CommandContext) => {
        // This will be handled by the UI
      },
    },
    keywords: ["schedule", "automation", "cron"],
    priority: 79,
  },
  {
    id: "action-upload-files",
    label: "Upload Files",
    description: "Open file upload dialog",
    icon: <Upload className="size-4" />,
    category: "server-management",
    type: "form",
    isAvailable: (ctx: CommandContext) => canControlServer(ctx),
    action: {
      openForm: (ctx: CommandContext) => {
        // This will be handled by the UI
      },
    },
    keywords: ["upload", "files", "transfer"],
    priority: 78,
  },
];
