"use client";

import { Loader2Icon, ServerIcon, DownloadIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";

interface ServerInstallingPlaceholderProps {
  isDark?: boolean;
  serverName?: string;
}

export const ServerInstallingPlaceholder = ({
  isDark = true,
  serverName,
}: ServerInstallingPlaceholderProps) => {
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
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className={cn(
              "absolute inset-0 rounded-full border-2 border-dashed",
              isDark ? "border-zinc-700" : "border-zinc-300"
            )}
            style={{ width: 80, height: 80, margin: -8 }}
          />
          <div
            className={cn(
              "relative flex h-16 w-16 items-center justify-center border",
              isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-300 bg-white"
            )}
          >
            <ServerIcon className={cn("h-8 w-8", isDark ? "text-zinc-500" : "text-zinc-400")} />
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className={cn(
                "absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border",
                isDark ? "border-zinc-600 bg-zinc-800" : "border-zinc-300 bg-zinc-100"
              )}
            >
              <DownloadIcon className={cn("h-3 w-3", isDark ? "text-blue-400" : "text-blue-600")} />
            </motion.div>
          </div>
        </div>

        {/* Text content */}
        <div className="space-y-2 text-center">
          <h2
            className={cn(
              "text-lg font-medium tracking-wider uppercase",
              isDark ? "text-zinc-200" : "text-zinc-800"
            )}
          >
            Installing Server
          </h2>
          {serverName && (
            <p className={cn("font-mono text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>
              {serverName}
            </p>
          )}
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2">
          <Loader2Icon
            className={cn("h-4 w-4 animate-spin", isDark ? "text-zinc-500" : "text-zinc-400")}
          />
          <span
            className={cn(
              "text-xs tracking-wider uppercase",
              isDark ? "text-zinc-500" : "text-zinc-500"
            )}
          >
            Please wait while your server is being set up...
          </span>
        </div>

        {/* Progress hints */}
        <div
          className={cn(
            "mt-4 space-y-1 border p-4 text-xs",
            isDark
              ? "border-zinc-800 bg-zinc-900/50 text-zinc-500"
              : "border-zinc-200 bg-zinc-50 text-zinc-500"
          )}
        >
          <p>This page will automatically update when installation is complete.</p>
          <p>Installation typically takes 1-5 minutes depending on the server type.</p>
        </div>
      </motion.div>
    </div>
  );
};
