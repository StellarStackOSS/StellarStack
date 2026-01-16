"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";

interface CardWithCornersProps {
  children: ReactNode;
  isDark?: boolean;
  className?: string;
}

export const CardWithCorners = ({ children, isDark = true, className }: CardWithCornersProps) => (
  <div
    className={cn(
      "relative border p-6 transition-all",
      isDark
        ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
        : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100",
      className
    )}
  >
    {/* Corner decorations */}
    <div
      className={cn(
        "absolute top-0 left-0 h-2 w-2 border-t border-l",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    <div
      className={cn(
        "absolute top-0 right-0 h-2 w-2 border-t border-r",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    <div
      className={cn(
        "absolute bottom-0 left-0 h-2 w-2 border-b border-l",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    <div
      className={cn(
        "absolute right-0 bottom-0 h-2 w-2 border-r border-b",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    {children}
  </div>
);
