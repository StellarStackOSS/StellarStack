"use client";

import type { JSX } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { UsageCard, UsageCardContent, UsageCardTitle } from "../usage-card";
import { InfoTooltip } from "../info-tooltip";
import { Sparkline } from "../sparkline";
import { AnimatedNumber } from "../animated-number";
import { useDragDropGrid } from "../drag-drop-grid";
import { getUsageColor } from "../dashboard-cards-utils";
import type { UsageMetricCardProps, UsageMetricCardLabels } from "../dashboard-cards-types";

interface UsageMetricCardComponentProps extends UsageMetricCardProps {
  isDark: boolean;
  isOffline: boolean;
  labels: UsageMetricCardLabels;
  primaryValue?: string;
}

export const UsageMetricCard = ({
  itemId,
  percentage,
  tooltipContent,
  history,
  color,
  isDark,
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

  const sparklineColor = isOffline
    ? isDark
      ? "#71717a"
      : "#a1a1aa"
    : color || getUsageColor(percentage, isDark);

  if (isXxs) {
    return (
      <UsageCard
        isDark={isDark}
        className={cn("flex h-full items-center justify-between px-6", isOffline && "opacity-60")}
      >
        <span
          className={cn(
            "text-xs font-medium uppercase",
            isDark ? "text-zinc-400" : "text-zinc-600"
          )}
        >
          {labels.title}
        </span>
        <span
          className={cn(
            primaryValue ? "text-base" : "text-xl",
            "font-mono",
            isOffline
              ? isDark
                ? "text-zinc-500"
                : "text-zinc-400"
              : isDark
                ? "text-zinc-100"
                : "text-zinc-800"
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
    <UsageCard isDark={isDark} className={cn("h-full", isXs && "p-4", isOffline && "opacity-60")}>
      {tooltipContent && (
        <InfoTooltip content={tooltipContent} visible={!isEditing} isDark={isDark} />
      )}
      <UsageCardTitle
        isDark={isDark}
        className={cn("opacity-80", isXs ? "mb-2 text-xs" : isCompact ? "mb-4 text-xs" : "text-md")}
      >
        {labels.title}
      </UsageCardTitle>
      <UsageCardContent className={isXs ? "space-y-1" : undefined}>
        <span
          className={cn(
            isOffline
              ? isDark
                ? "text-zinc-500"
                : "text-zinc-400"
              : isDark
                ? "text-zinc-100"
                : "text-zinc-800",
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
              isDark={isDark}
            />
          </div>
        )}
      </UsageCardContent>
    </UsageCard>
  );
};
