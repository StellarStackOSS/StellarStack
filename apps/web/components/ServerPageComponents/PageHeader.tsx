"use client";

import { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { Button } from "@workspace/ui/components/button";
import { BsMoon, BsSun } from "react-icons/bs";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  isDark?: boolean;
  actions?: ReactNode;
  onThemeToggle?: () => void;
}

export const PageHeader = ({
  title,
  subtitle,
  isDark = true,
  actions,
  onThemeToggle,
}: PageHeaderProps) => (
  <div className="mb-8 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <SidebarTrigger
        className={cn(
          "transition-all hover:scale-110 active:scale-95",
          isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-900"
        )}
      />
      <div>
        <h1
          className={cn(
            "text-2xl font-light tracking-wider",
            isDark ? "text-zinc-100" : "text-zinc-800"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className={cn("mt-1 text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {actions}
      {onThemeToggle && (
        <Button
          variant="outline"
          size="sm"
          onClick={onThemeToggle}
          className={cn(
            "p-2 transition-all hover:scale-110 active:scale-95",
            isDark
              ? "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
              : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
          )}
        >
          {isDark ? <BsSun className="h-4 w-4" /> : <BsMoon className="h-4 w-4" />}
        </Button>
      )}
    </div>
  </div>
);
