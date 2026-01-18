"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";

interface AdminCardProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

export const AdminCard = ({ icon, title, description, children, actions }: AdminCardProps) => (
  <div
    className={cn(
      "relative border p-4 transition-colors",
      "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] hover:border-zinc-700"
    )}
  >
    <div className="flex items-start justify-between">
      <div className="flex flex-1 items-start gap-3">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          {title && <div className={cn("font-medium", "text-zinc-100")}>{title}</div>}
          {description && <div className={cn("mt-1 text-xs", "text-zinc-500")}>{description}</div>}
          {children}
        </div>
      </div>
      {actions && <div className="ml-2 flex items-center gap-1">{actions}</div>}
    </div>
  </div>
);
