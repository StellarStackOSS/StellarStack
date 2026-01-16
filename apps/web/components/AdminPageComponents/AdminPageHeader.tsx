"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  isDark?: boolean;
  action?: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
  };
  showBackButton?: boolean;
}

export const AdminPageHeader = ({
  title,
  description,
  isDark = true,
  action,
  showBackButton = true,
}: AdminPageHeaderProps) => {
  const router = useRouter();

  return (
    <div className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin")}
            className={cn(
              "p-2 transition-all hover:scale-110 active:scale-95",
              isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1
            className={cn(
              "text-2xl font-light tracking-wider",
              isDark ? "text-zinc-100" : "text-zinc-800"
            )}
          >
            {title}
          </h1>
          {description && (
            <p className={cn("mt-1 text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          className={cn(
            "flex items-center gap-2 text-xs uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95",
            isDark
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          )}
        >
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
};
