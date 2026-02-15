"use client";

import type { JSX } from "react";
import { cn } from "@stellarUI/lib/Utils";
import UsageCard, { UsageCardContent } from "../UsageCard/UsageCard";
import { AnimatedNumber } from "../AnimatedNumber/AnimatedNumber";
import { useDragDropGrid } from "../DragDropGrid/DragDropGrid";
import { formatUptime } from "../DashboardCardsUtils/Utils";
import type {
  CardProps,
  ContainerStatus,
  ContainerUptimeCardLabels,
} from "../DashboardCardsTypes/Types";

interface ContainerUptimeCardProps extends CardProps {
  isOffline: boolean;
  containerUptime: number;
  containerStatus: ContainerStatus;
  labels: ContainerUptimeCardLabels;
}

const ContainerUptimeCard = ({
  itemId,
  isOffline,
  containerUptime,
  containerStatus,
  labels,
}: ContainerUptimeCardProps): JSX.Element => {
  const { getItemSize } = useDragDropGrid();
  const size = getItemSize(itemId);

  const isXxs = size === "xxs" || size === "xxs-wide";
  const isXs = size === "xs";

  const uptime = formatUptime(containerUptime);
  const isRunning = containerStatus === "running";

  if (isXxs) {
    return (
      <UsageCard
        className={cn("flex h-full items-center justify-between px-6", isOffline && "opacity-60")}
      >
        <span className={cn("text-xs font-medium uppercase", "text-zinc-400")}>
          {labels.titleShort}
        </span>
        <span className={cn("font-mono text-xl", "text-zinc-100")}>
          {isOffline || !isRunning ? "--" : uptime.full}
        </span>
      </UsageCard>
    );
  }

  return (
    <UsageCard title={labels.title} className={cn("h-full", isOffline && "opacity-60")}>
      <UsageCardContent className={isXs ? "space-y-1" : undefined}>
        <div className="flex items-baseline gap-2">
          <span className={cn("text-zinc-100", isXs ? "text-2xl" : "text-4xl")}>
            {isOffline || !isRunning ? "--" : <AnimatedNumber value={parseInt(uptime.value)} />}
          </span>
          <span className={cn("uppercase", "text-zinc-500", isXs ? "text-xs" : "text-sm")}>
            {isRunning ? uptime.unit : ""}
          </span>
        </div>
        {!isXs && (
          <div className={cn("mt-2 text-xs", "text-zinc-500")}>
            {isRunning ? uptime.full : labels.containerStopped}
          </div>
        )}
      </UsageCardContent>
    </UsageCard>
  );
};

export default ContainerUptimeCard;
