"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { CornerAccents } from "@/hooks/use-admin-theme";

interface AdminCardProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

export const AdminCard = ({
  icon,
  title,
  description,
  children,
  actions,
}: AdminCardProps) => (
  <div
    className={cn(
      "relative p-4 border transition-colors",
      "bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10 hover:border-zinc-700"
    )}
  >
    <CornerAccents size="sm" />

    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3 flex-1">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          {title && (
            <div className={cn("font-medium", "text-zinc-100")}>
              {title}
            </div>
          )}
          {description && (
            <div className={cn("text-xs mt-1", "text-zinc-500")}>
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
