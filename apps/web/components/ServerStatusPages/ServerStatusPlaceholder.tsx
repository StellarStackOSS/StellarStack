"use client";

import { ReactNode } from "react";
import { Download, Loader2, RotateCcw, Server, Wrench } from "lucide-react";
import { cn } from "@stellarUI/lib/Utils";
import { motion } from "framer-motion";
import { CgDanger } from "react-icons/cg";

type StatusType = "suspended" | "restoring" | "maintenance" | "installing";

interface ServerStatusPlaceholderProps {
  serverName?: string;
  status: StatusType;
}

const STATUS_CONFIG: Record<
  StatusType,
  {
    title: string;
    icon: ReactNode;
    badgeIcon: ReactNode;
    badgeColor: string;
    loadingElement: ReactNode;
    message: string[];
    animatedElement?: ReactNode;
  }
> = {
  suspended: {
    title: "Server Suspended",
    icon: <CgDanger className="h-3 w-3" />,
    badgeIcon: <CgDanger className="h-3 w-3" />,
    badgeColor: "red",
    loadingElement: null,
    message: [
      "This server has been suspended by an administrator.",
      "Please contact support if you believe this is an error.",
    ],
  },
  restoring: {
    title: "Restoring Backup",
    icon: <RotateCcw className="h-3 w-3" />,
    badgeIcon: (
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <RotateCcw className="h-3 w-3" />
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
    icon: <Wrench className="h-3 w-3" />,
    badgeIcon: <Wrench className="h-3 w-3" />,
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
    icon: <Download className="h-3 w-3" />,
    badgeIcon: <Download className="h-3 w-3" />,
    badgeColor: "zinc",
    loadingElement: "spinner",
    message: [
      "This page will automatically update when installation is complete.",
      "Installation typically takes 1-5 minutes depending on the server type.",
    ],
  },
};

const getPulseColor = (color: string) => {
  const colors = {
    red: "bg-red-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    zinc: "bg-zinc-500",
  };
  return colors[color as keyof typeof colors] || colors.zinc;
};

const getBadgeColors = (color: string) => {
  const colors = {
    red: {
      border: "border-red-700",
      bg: "bg-red-900/50",
      text: "text-red-400",
    },
    blue: {
      border: "border-blue-700",
      bg: "bg-blue-900/50",
      text: "text-blue-400",
    },
    amber: {
      border: "border-amber-700",
      bg: "bg-amber-900/50",
      text: "text-amber-400",
    },
    zinc: {
      border: "border-zinc-600",
      bg: "bg-zinc-800",
      text: "text-blue-400",
    },
  };
  return colors[color as keyof typeof colors] || colors.zinc;
};

const renderLoadingElement = (type: string | null, color: string) => {
  if (!type) return null;

  if (type === "dots") {
    const pulseColor = getPulseColor(color);
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
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        <span className="text-xs tracking-wider text-zinc-500 uppercase">
          Please wait while your server is being set up...
        </span>
      </div>
    );
  }

  return null;
};

export const ServerStatusPlaceholder = ({ serverName, status }: ServerStatusPlaceholderProps) => {
  const config = STATUS_CONFIG[status];
  const badgeColors = getBadgeColors(config.badgeColor);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-zinc-300">
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
              className="absolute inset-0 rounded-full border-2 border-dashed border-zinc-700"
              style={{ width: 80, height: 80, margin: -8 }}
            />
          )}
          <div className="relative flex h-16 w-16 items-center justify-center border border-zinc-700 bg-zinc-900">
            <Server className="h-8 w-8 text-zinc-600" />
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className={cn(
                "absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border",
                badgeColors.border,
                badgeColors.bg
              )}
            >
              <div className={badgeColors.text}>{config.badgeIcon}</div>
            </motion.div>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h2 className="text-lg font-medium tracking-wider text-zinc-200 uppercase">
            {config.title}
          </h2>
          {serverName && <p className="font-mono text-sm text-zinc-500">{serverName}</p>}
        </div>

        {renderLoadingElement(config.loadingElement as string | null, config.badgeColor)}

        <div className="mt-4 space-y-1 border border-zinc-800 bg-zinc-900/50 p-4 text-center text-xs text-zinc-500">
          {config.message.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
