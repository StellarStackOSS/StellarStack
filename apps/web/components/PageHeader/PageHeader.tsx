"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => (
  <div className="mb-8 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <SidebarTrigger
        className={cn(
          "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
        )}
      />
      <div>
        <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>{title}</h1>
        {subtitle && <p className={cn("mt-1 text-sm text-zinc-500")}>{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2">{actions}</div>
  </div>
);
