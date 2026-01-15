"use client";

import { ServerIcon, WrenchIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";

interface ServerMaintenancePlaceholderProps {
  isDark?: boolean;
  serverName?: string;
}

export const ServerMaintenancePlaceholder = ({
  isDark = true,
  serverName,
}: ServerMaintenancePlaceholderProps) => {
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
        {/* Icon container */}
        <div className="relative">
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
              className={cn(
                "absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border",
                isDark ? "border-amber-700 bg-amber-900/50" : "border-amber-300 bg-amber-100"
              )}
            >
              <WrenchIcon className={cn("h-3 w-3", isDark ? "text-amber-400" : "text-amber-600")} />
            </motion.div>
          </div>
        </div>

        {/* Animated wrench */}
        <motion.div
          animate={{
            rotate: [0, -15, 15, -15, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1,
          }}
          className="absolute"
        />

        {/* Text content */}
        <div className="space-y-2 text-center">
          <h2
            className={cn(
              "text-lg font-medium tracking-wider uppercase",
              isDark ? "text-zinc-200" : "text-zinc-800"
            )}
          >
            Under Maintenance
          </h2>
          {serverName && (
            <p className={cn("font-mono text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>
              {serverName}
            </p>
          )}
        </div>

        {/* Info message */}
        <div
          className={cn(
            "mt-4 space-y-1 border p-4 text-center text-xs",
            isDark
              ? "border-zinc-800 bg-zinc-900/50 text-zinc-500"
              : "border-zinc-200 bg-zinc-50 text-zinc-500"
          )}
        >
          <p>This server is currently under maintenance.</p>
          <p>The node is being updated. Please wait...</p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-1.5 w-1.5 animate-pulse rounded-full",
              isDark ? "bg-amber-500" : "bg-amber-400"
            )}
            style={{ animationDelay: "0ms" }}
          />
          <div
            className={cn(
              "h-1.5 w-1.5 animate-pulse rounded-full",
              isDark ? "bg-amber-500" : "bg-amber-400"
            )}
            style={{ animationDelay: "300ms" }}
          />
          <div
            className={cn(
              "h-1.5 w-1.5 animate-pulse rounded-full",
              isDark ? "bg-amber-500" : "bg-amber-400"
            )}
            style={{ animationDelay: "600ms" }}
          />
        </div>
      </motion.div>
    </div>
  );
};
