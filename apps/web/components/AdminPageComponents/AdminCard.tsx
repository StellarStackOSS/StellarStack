"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { CornerAccents } from "@/hooks/use-admin-theme";

interface AdminCardProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  isDark?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}

export const AdminCard = ({
  icon,
  title,
  description,
  isDark = true,
  children,
  actions,
}: AdminCardProps) => (
  <div
    className={cn(
      "relative p-4 border transition-colors",
      isDark
        ? "bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10 hover:border-zinc-700"
        : "bg-gradient-to-b from-white via-zinc-50 to-zinc-100 border-zinc-300 hover:border-zinc-400"
    )}
  >
    <CornerAccents isDark={isDark} size="sm" />

    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3 flex-1">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          {title && (
            <div className={cn("font-medium", isDark ? "text-zinc-100" : "text-zinc-800")}>
              {title}
            </div>
          )}
          {description && (
            <div className={cn("text-xs mt-1", isDark ? "text-zinc-500" : "text-zinc-400")}>
              {description}
            </div>
          )}
          {children}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1 ml-2">{actions}</div>}
    </div>
  </div>
);
