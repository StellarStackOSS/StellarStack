"use client";

import { cn } from "@stellarUI/lib/utils";
import { Search } from "lucide-react";
import Input from "@stellarUI/components/Input/Input";

interface AdminSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const AdminSearchBar = ({
  value,
  onChange,
  placeholder = "Search...",
}: AdminSearchBarProps) => (
  <div className="relative mb-6">
    <Search
      className={cn("absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2", "text-zinc-500")}
    />
    <Input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);
