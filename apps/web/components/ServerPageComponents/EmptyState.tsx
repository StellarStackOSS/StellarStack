"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  isDark?: boolean;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  isDark = true,
}: EmptyStateProps) => (
  <div
    className={cn(
      "relative border p-8 text-center",
      isDark
        ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
        : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100"
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

    <div className={cn("mx-auto mb-4 h-12 w-12", isDark ? "text-zinc-600" : "text-zinc-400")}>
      {icon}
    </div>
    <h3 className={cn("mb-2 text-lg font-medium", isDark ? "text-zinc-300" : "text-zinc-700")}>
      {title}
    </h3>
    <p className={cn("mb-4 text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>{description}</p>
    {action && (
      <Button
        variant="outline"
        size="sm"
        onClick={action.onClick}
        className={cn(
          "gap-2",
          isDark
            ? "border-zinc-700 text-zinc-400 hover:text-zinc-100"
            : "border-zinc-300 text-zinc-600 hover:text-zinc-900"
        )}
      >
        {action.label}
      </Button>
    )}
  </div>
);
