"use client";

import { cn } from "@workspace/ui/lib/utils";
import { SearchIcon } from "lucide-react";

interface AdminSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDark?: boolean;
}

export const AdminSearchBar = ({
  value,
  onChange,
  placeholder = "Search...",
  isDark = true,
}: AdminSearchBarProps) => (
  <div className="relative mb-6">
    <SearchIcon
      className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", isDark ? "text-zinc-500" : "text-zinc-400")}
    />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full pl-10 pr-4 py-2.5 border text-sm transition-colors focus:outline-none",
        isDark
          ? "bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500"
          : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400"
      )}
    />
  </div>
);
