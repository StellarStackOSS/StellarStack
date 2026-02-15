"use client";

import type { JSX } from "react";
import { cn } from "@stellarUI/lib/Utils";
import UsageCard, { UsageCardContent } from "../UsageCard/UsageCard";
import { useDragDropGrid } from "../DragDropGrid/DragDropGrid";
import type {
  CardProps,
  NetworkInfoData,
  NetworkInfoCardLabels,
} from "../DashboardCardsTypes/Types";

interface NetworkInfoCardProps extends CardProps {
  networkInfo: NetworkInfoData;
  labels: NetworkInfoCardLabels;
}

const NetworkInfoCard = ({ itemId, networkInfo, labels }: NetworkInfoCardProps): JSX.Element => {
  const { getItemSize } = useDragDropGrid();
  const size = getItemSize(itemId);

  const isXxs = size === "xxs" || size === "xxs-wide";
  const isXs = size === "xs";
  const isCompact = size === "xs" || size === "sm";
  const isLarge = size === "lg" || size === "xl";

  const labelColor = "text-zinc-500";
  const valueColor = "text-zinc-200";
  const badgeBg = "bg-zinc-800 text-zinc-300";

  const visiblePorts = isLarge ? networkInfo.openPorts : networkInfo.openPorts.slice(0, 3);
  const portsString = networkInfo.openPorts
    .slice(0, 3)
    .map((p) => p.port)
    .join(", ");

  if (isXxs) {
    return (
      <UsageCard className="flex h-full items-center justify-between px-6">
        <span className={cn("text-xs font-medium uppercase", "text-zinc-400")}>
          {labels.titleShort}
        </span>
        <span className={cn("ml-4 truncate font-mono text-sm", "text-zinc-100")}>
          {networkInfo.publicIp}
        </span>
      </UsageCard>
    );
  }

  return (
    <UsageCard title={isXs ? labels.titleShort : labels.title} className="h-full">
      <UsageCardContent className={isXs ? "space-y-1" : undefined}>
        <div
          className={cn(
            isXs ? "space-y-1 text-[10px]" : isCompact ? "space-y-2 text-xs" : "space-y-3 text-sm"
          )}
        >
          <div>
            <div className={cn(labelColor, "mb-0.5", isXs ? "text-[9px]" : "text-xs")}>
              {isXs ? labels.publicIpShort : labels.publicIp}
            </div>
            <div className={cn(valueColor, "font-mono", isXs && "text-[10px]")}>
              {networkInfo.publicIp}
            </div>
          </div>
          {!isXs && !isCompact && networkInfo.privateIp && (
            <div>
              <div className={cn(labelColor, "mb-0.5 text-xs")}>{labels.privateIp}</div>
              <div className={cn(valueColor, "font-mono")}>{networkInfo.privateIp}</div>
            </div>
          )}
          {!isXs && (
            <div>
              <div className={cn(labelColor, "mb-0.5 text-xs")}>{labels.openPorts}</div>
              <div className={cn("mt-1 flex flex-wrap gap-1", isLarge && "gap-2")}>
                {visiblePorts.map((portInfo) => (
                  <span key={portInfo.port} className={cn("rounded px-2 py-0.5 text-xs", badgeBg)}>
                    {portInfo.port} {portInfo.protocol}
                  </span>
                ))}
              </div>
            </div>
          )}
          {isXs && (
            <div>
              <div className={cn(labelColor, "mb-0.5 text-[9px]")}>{labels.portsShort}</div>
              <div className={cn(valueColor, "font-mono text-[10px]")}>{portsString}</div>
            </div>
          )}
          {isLarge && networkInfo.macAddress && (
            <div>
              <div className={cn(labelColor, "mb-0.5 text-xs")}>{labels.macAddress}</div>
              <div className={cn(valueColor, "font-mono")}>{networkInfo.macAddress}</div>
            </div>
          )}
        </div>
      </UsageCardContent>
    </UsageCard>
  );
};

export default NetworkInfoCard;
