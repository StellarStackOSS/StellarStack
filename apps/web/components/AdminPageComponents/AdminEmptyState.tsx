"use client";

import {cn} from "@workspace/ui/lib/utils";

interface AdminEmptyStateProps {
  message: string;
  columnSpan?: string;
}

export const AdminEmptyState = ({
  message,
  columnSpan = "col-span-full",
}: AdminEmptyStateProps) => (
  <div
    className={cn(
      columnSpan,
      "text-center py-12 border border-zinc-800 text-zinc-500"
    )}
  >
    {message}
  </div>
);
