"use client";

import { FiInfo } from "react-icons/fi";
import { cn } from "@stellarUI/lib/Utils";
import Tooltip, { TooltipContent, TooltipTrigger } from "@stellarUI/components/Tooltip/Tooltip";

interface InfoTooltipProps {
  content: React.ReactNode;
  className?: string;
  visible?: boolean;
}

const InfoTooltip = ({ content, className, visible = true }: InfoTooltipProps) => {
  if (!visible) return null;

  return (
    <div className={cn("absolute top-4 right-4 z-10", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "rounded-full p-1.5 transition-colors",
              "bg-zinc-800/60 hover:bg-zinc-700/80"
            )}
          >
            <FiInfo className={cn("h-3.5 w-3.5", "text-zinc-400")} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          className={cn(
            "relative max-w-[300px] min-w-[220px] rounded-none border p-4 backdrop-blur-md",
            "border-zinc-200/10 bg-[#0f0f0f]/80"
          )}
        >
          {/* Corner accents matching UsageCard */}
          <div
            className={cn("absolute top-0 left-0 h-2 w-2 border-t border-l", "border-zinc-500")}
          />
          <div
            className={cn("absolute top-0 right-0 h-2 w-2 border-t border-r", "border-zinc-500")}
          />
          <div
            className={cn("absolute bottom-0 left-0 h-2 w-2 border-b border-l", "border-zinc-500")}
          />
          <div
            className={cn("absolute right-0 bottom-0 h-2 w-2 border-r border-b", "border-zinc-500")}
          />

          <div className={cn("space-y-2 text-xs", "text-zinc-300")}>{content}</div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow = ({ label, value }: InfoRowProps) => {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("text-right font-mono", "text-zinc-200")}>{value}</span>
    </div>
  );
};

export { InfoTooltip, InfoRow };
