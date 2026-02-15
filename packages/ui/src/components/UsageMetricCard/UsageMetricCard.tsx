"use client";

import type {JSX} from "react";
import {cn} from "@stellarUI/lib/Utils";
import UsageCard, { UsageCardContent } from "../UsageCard/UsageCard";
import { InfoTooltip } from "../InfoTooltip/InfoTooltip";
import { Sparkline } from "../Sparkline/Sparkline";
import { AnimatedNumber } from "../AnimatedNumber/AnimatedNumber";
import { useDragDropGrid } from "../DragDropGrid/DragDropGrid";
import { getUsageColor } from "../DashboardCardsUtils/Utils";
import type { UsageMetricCardLabels, UsageMetricCardProps } from "../DashboardCardsTypes/Types";

interface UsageMetricCardComponentProps extends UsageMetricCardProps {
  isOffline: boolean;
  labels: UsageMetricCardLabels;
  primaryValue?: string;
}

const UsageMetricCard = ({
  itemId,
  percentage,
  tooltipContent,
  history,
  color,
  isOffline,
  labels,
  primaryValue,
}: UsageMetricCardComponentProps): JSX.Element => {
  const { getItemSize, isEditing } = useDragDropGrid();
  const size = getItemSize(itemId);

  const isXxs = size === "xxs" || size === "xxs-wide";
  const isXs = size === "xs";
  const isCompact = size === "xs" || size === "sm" || size === "xxs" || size === "xxs-wide";
  const isLarge = size === "lg" || size === "xl";

  const sparklineColor = isOffline ? "#71717a" : (color || getUsageColor(percentage));

  if (isXxs) {
    return (
      <UsageCard
        className={cn("flex h-full items-center justify-between px-6", isOffline && "opacity-60")}
      >
        <span
          className={cn(
            "text-xs font-medium uppercase text-zinc-400",
          )}
        >
          {labels.title}
        </span>
        <span
          className={cn(
            primaryValue ? "text-base" : "text-xl",
            "font-mono",
            isOffline
              ? "text-zinc-400"
              : "text-zinc-100"
          )}
        >
          {isOffline ? (
            "--"
          ) : primaryValue ? (
            primaryValue
          ) : (
            <AnimatedNumber value={percentage} suffix="%" />
          )}
        </span>
      </UsageCard>
    );
  }

  return (
    <UsageCard title={labels.title} className={cn("h-full", isOffline && "opacity-60")}>
      {tooltipContent && (
        <InfoTooltip content={tooltipContent} visible={!isEditing} />
      )}
      <UsageCardContent className={isXs ? "space-y-1" : undefined}>
        <span
          className={cn(
            isOffline
              ? "text-zinc-500"
              : "text-zinc-100",
            primaryValue
              ? isXs
                ? "text-lg"
                : isCompact
                  ? "text-xl"
                  : isLarge
                    ? "text-3xl"
                    : "text-2xl"
              : isXs
                ? "text-xl"
                : isCompact
                  ? "text-2xl"
                  : isLarge
                    ? "text-5xl"
                    : "text-4xl"
          )}
        >
          {isOffline ? (
            "--"
          ) : primaryValue ? (
            primaryValue
          ) : (
            <AnimatedNumber value={percentage} suffix="%" />
          )}
        </span>
        {history && (
          <div className={cn("mt-auto", isCompact ? "pt-2" : "pt-4")}>
            <Sparkline
              data={history}
              color={sparklineColor}
              height={isXs ? 40 : isCompact ? 50 : 60}
            />
          </div>
        )}
      </UsageCardContent>
    </UsageCard>
  );
};

export default UsageMetricCard;
