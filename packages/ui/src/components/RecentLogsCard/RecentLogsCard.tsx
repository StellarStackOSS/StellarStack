"use client";

import type { JSX } from "react";
import { cn } from "@stellarUI/lib/Utils";
import UsageCard, { UsageCardContent, UsageCardTitle } from "../UsageCard/UsageCard";
import { useDragDropGrid } from "../DragDropGrid/DragDropGrid";
import type { CardProps, LogEntry, RecentLogsCardLabels } from "../DashboardCardsTypes/Types";

interface RecentLogsCardProps extends CardProps {
  isOffline: boolean;
  logs: LogEntry[];
  labels: RecentLogsCardLabels;
}

const RecentLogsCard = ({
  itemId,
  isOffline,
  logs,
  labels,
}: RecentLogsCardProps): JSX.Element => {
  const { getItemSize } = useDragDropGrid();
  const size = getItemSize(itemId);

  const isXs = size === "xs";

  const getLevelColor = (level: string): string => {
    switch (level) {
      case "error": return "text-red-400";
      case "warning": return "text-amber-400";
      default: return "text-zinc-400";
    }
  };

  return (
    <UsageCard title={labels.title} className={cn("h-full flex flex-col", isOffline && "opacity-60")}>
      <UsageCardContent className="flex-1 overflow-hidden">
        <div className="space-y-0.5 overflow-y-auto h-full font-mono text-[10px]">
          {logs.slice(0, isXs ? 5 : 8).map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className={cn("shrink-0", "text-zinc-600")}>
                {log.time}
              </span>
              <span className={cn("truncate", getLevelColor(log.level))}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </UsageCardContent>
    </UsageCard>
  );
};

export default RecentLogsCard;
