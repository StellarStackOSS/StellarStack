"use client";

import { ReactNode } from "react";
import { ServerIcon, BanIcon, RotateCcwIcon, WrenchIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";

type StatusType = "suspended" | "restoring" | "maintenance" | "installing";

interface ServerStatusPlaceholderProps {
  isDark?: boolean;
  serverName?: string;
  status: StatusType;
}

const STATUS_CONFIG: Record<StatusType, {
  title: string;
  icon: ReactNode;
  badgeIcon: ReactNode;
  badgeColor: string;
  loadingElement: ReactNode;
  message: string[];
  animatedElement?: ReactNode;
}> = {
  suspended: {
    title: "Server Suspended",
    icon: <BanIcon className="h-3 w-3" />,
    badgeIcon: <BanIcon className="h-3 w-3" />,
    badgeColor: "red",
    loadingElement: null,
    message: [
      "This server has been suspended by an administrator.",
      "Please contact support if you believe this is an error.",
    ],
  },
  restoring: {
    title: "Restoring Backup",
    icon: <RotateCcwIcon className="h-3 w-3" />,
    badgeIcon: (
      <motion.div animate={{ rotate: -360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
        <RotateCcwIcon className="h-3 w-3" />
      </motion.div>
    ),
    badgeColor: "blue",
    loadingElement: "dots",
    message: [
      "This server is currently being restored from a backup.",
      "Please wait while your files are being recovered...",
    ],
  },
  maintenance: {
    title: "Under Maintenance",
    icon: <WrenchIcon className="h-3 w-3" />,
    badgeIcon: <WrenchIcon className="h-3 w-3" />,
    badgeColor: "amber",
    loadingElement: "dots",
    message: [
      "This server is currently under maintenance.",
      "The node is being updated. Please wait...",
    ],
    animatedElement: (
      <motion.div
        animate={{ rotate: [0, -15, 15, -15, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        className="absolute"
      />
    ),
  },
  installing: {
    title: "Installing Server",
    icon: <DownloadIcon className="h-3 w-3" />,
    badgeIcon: <DownloadIcon className="h-3 w-3" />,
    badgeColor: "zinc",
    loadingElement: "spinner",
    message: [
      "This page will automatically update when installation is complete.",
      "Installation typically takes 1-5 minutes depending on the server type.",
    ],
  },
};

const getPulseColor = (color: string, isDark: boolean) => {
  const colors = {
    red: isDark ? "bg-red-500" : "bg-red-400",
    blue: isDark ? "bg-blue-500" : "bg-blue-400",
    amber: isDark ? "bg-amber-500" : "bg-amber-400",
    zinc: isDark ? "bg-zinc-500" : "bg-zinc-400",
  };
  return colors[color as keyof typeof colors] || colors.zinc;
};

const getBadgeColors = (color: string, isDark: boolean) => {
  const colors = {
    red: {
      border: isDark ? "border-red-700" : "border-red-300",
      bg: isDark ? "bg-red-900/50" : "bg-red-100",
      text: isDark ? "text-red-400" : "text-red-600",
    },
    blue: {
      border: isDark ? "border-blue-700" : "border-blue-300",
      bg: isDark ? "bg-blue-900/50" : "bg-blue-100",
      text: isDark ? "text-blue-400" : "text-blue-600",
    },
    amber: {
      border: isDark ? "border-amber-700" : "border-amber-300",
      bg: isDark ? "bg-amber-900/50" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-600",
    },
    zinc: {
      border: isDark ? "border-zinc-600" : "border-zinc-300",
      bg: isDark ? "bg-zinc-800" : "bg-zinc-100",
      text: isDark ? "text-blue-400" : "text-blue-600",
    },
  };
  return colors[color as keyof typeof colors] || colors.zinc;
};

const renderLoadingElement = (type: string | null, isDark: boolean, color: string) => {
  if (!type) return null;

  if (type === "dots") {
    const pulseColor = getPulseColor(color, isDark);
    return (
      <div className="flex items-center gap-2">
        {[0, 300, 600].map((delay) => (
          <div
            key={delay}
            className={cn("h-1.5 w-1.5 animate-pulse rounded-full", pulseColor)}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    );
  }

  if (type === "spinner") {
    return (
      <div className="flex items-center gap-2">
        <Loader2Icon className={cn("h-4 w-4 animate-spin", isDark ? "text-zinc-500" : "text-zinc-400")} />
        <span className={cn("text-xs tracking-wider uppercase", isDark ? "text-zinc-500" : "text-zinc-500")}>
          Please wait while your server is being set up...
        </span>
      </div>
    );
  }

  return null;
};

export const ServerStatusPlaceholder = ({ isDark = true, serverName, status }: ServerStatusPlaceholderProps) => {
  const config = STATUS_CONFIG[status];
  const badgeColors = getBadgeColors(config.badgeColor, isDark);

  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center p-8",
        isDark ? "text-zinc-300" : "text-zinc-700"
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        {config.animatedElement}

        <div className="relative">
          {status === "installing" && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className={cn("absolute inset-0 rounded-full border-2 border-dashed", isDark ? "border-zinc-700" : "border-zinc-300")}
              style={{ width: 80, height: 80, margin: -8 }}
            />
          )}
          <div
            className={cn(
              "relative flex h-16 w-16 items-center justify-center border",
              isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-300 bg-white"
            )}
          >
            <ServerIcon className={cn("h-8 w-8", isDark ? "text-zinc-600" : "text-zinc-400")} />
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className={cn("absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border", badgeColors.border, badgeColors.bg)}
            >
              <div className={badgeColors.text}>{config.badgeIcon}</div>
            </motion.div>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h2 className={cn("text-lg font-medium tracking-wider uppercase", isDark ? "text-zinc-200" : "text-zinc-800")}>
            {config.title}
          </h2>
          {serverName && <p className={cn("font-mono text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>{serverName}</p>}
        </div>

        {renderLoadingElement(config.loadingElement as string | null, isDark, config.badgeColor)}

        <div
          className={cn(
            "mt-4 space-y-1 border p-4 text-center text-xs",
            isDark ? "border-zinc-800 bg-zinc-900/50 text-zinc-500" : "border-zinc-200 bg-zinc-50 text-zinc-500"
          )}
        >
          {config.message.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
