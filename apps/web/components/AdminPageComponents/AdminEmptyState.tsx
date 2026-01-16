"use client";

import { cn } from "@workspace/ui/lib/utils";

interface AdminEmptyStateProps {
  message: string;
  isDark?: boolean;
  columnSpan?: string;
}

export const AdminEmptyState = ({
  message,
  isDark = true,
  columnSpan = "col-span-full",
}: AdminEmptyStateProps) => (
  <div
    className={cn(
      columnSpan,
      "text-center py-12 border",
      isDark ? "border-zinc-800 text-zinc-500" : "border-zinc-200 text-zinc-400"
    )}
  >
    {message}
  </div>
);
