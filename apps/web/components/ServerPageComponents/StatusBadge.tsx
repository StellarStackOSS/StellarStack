"use client";

import { cn } from "@workspace/ui/lib/utils";

type BadgeColor = "green" | "red" | "blue" | "amber" | "zinc";

interface StatusBadgeProps {
  label: string;
  color?: BadgeColor;
}

const colorConfig: Record<
  BadgeColor,
  {
    dark: string;
    light: string;
  }
> = {
  green: {
    dark: "border-green-700/50 text-green-400",
    light: "border-green-300 text-green-600",
  },
  red: {
    dark: "border-red-700/50 text-red-400",
    light: "border-red-300 text-red-600",
  },
  blue: {
    dark: "border-blue-700/50 text-blue-400",
    light: "border-blue-300 text-blue-600",
  },
  amber: {
    dark: "border-amber-700/50 text-amber-400",
    light: "border-amber-300 text-amber-600",
  },
  zinc: {
    dark: "border-zinc-700 text-zinc-400",
    light: "border-zinc-300 text-zinc-500",
  },
};

export const StatusBadge = ({ label, color = "zinc" }: StatusBadgeProps) => {
  const colors = colorConfig[color];

  return (
    <span
      className={cn(
        "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
        colors.dark
      )}
    >
      {label}
    </span>
  );
};
