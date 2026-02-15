"use client";

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@stellarUI/lib/Utils";
import UsageCard, { UsageCardContent } from "../UsageCard/UsageCard";
import { InfoTooltip } from "../InfoTooltip/InfoTooltip";
import { Sparkline } from "../Sparkline/Sparkline";
import { AnimatedNumber } from "../AnimatedNumber/AnimatedNumber";
import { useDragDropGrid } from "../DragDropGrid/DragDropGrid";
import CpuCoreGrid from "../CpuCoreGrid/CpuCoreGrid";
import { getUsageColor } from "../DashboardCardsUtils/Utils";
import type { CpuCardProps, CpuCardLabels } from "../DashboardCardsTypes/Types";

interface CpuCardComponentProps extends CpuCardProps {
  isOffline: boolean;
  labels: CpuCardLabels;
  primaryValue?: string;
}

const BLOCK_WIDTH = 6; // px
const BLOCK_HEIGHT = 6; // px
const GAP = 2; // px
const ROWS = 3;

const CpuCard = ({
  itemId,
  percentage,
  tooltipContent,
  history,
  coreUsage,
  isOffline,
  labels,
  primaryValue,
}: CpuCardComponentProps): JSX.Element => {
  const { getItemSize, isEditing } = useDragDropGrid();
  const size = getItemSize(itemId);

  const isXxs = size === "xxs" || size === "xxs-wide";
  const isXs = size === "xs";
  const isCompact = size === "xs" || size === "sm" || size === "xxs" || size === "xxs-wide";
  const isLarge = size === "lg" || size === "xl" || size === "xxl";
  const showCoreGrid = isLarge && coreUsage && coreUsage.length > 0;

  const sparklineColor = isOffline ? "#71717a" : getUsageColor(percentage);

  /* =========================
   * XXS PROGRESS GRID STATE
   * ========================= */
  const progressRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(0);

  useEffect(() => {
    if (!progressRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      const cols = Math.max(1, Math.floor(width / (BLOCK_WIDTH + GAP)));
      setColumns(cols);
    });

    observer.observe(progressRef.current);
    return () => observer.disconnect();
  }, []);

  // Column-based fill so all 3 rows stay in sync
  const filledColumns = isOffline ? 0 : Math.round((percentage / 100) * columns);

  /* =========================
   * XXS VARIANT
   * ========================= */
  if (isXxs) {
    return (
      <UsageCard
        className={cn("flex h-full flex-col justify-center gap-2 px-4", isOffline && "opacity-60")}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-md font-medium text-zinc-400 uppercase">{labels.title}</span>
          <span
            className={cn(
              "font-mono",
              primaryValue ? "text-sm" : "text-base",
              isOffline ? "text-zinc-500" : "text-zinc-100"
            )}
          >
            {isOffline ? "--" : (primaryValue ?? <AnimatedNumber value={percentage} suffix="%" />)}
          </span>
        </div>

        {/* Progress Grid (3 synced rows, responsive columns) */}
        <div
          ref={progressRef}
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${columns}, ${BLOCK_WIDTH}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${BLOCK_HEIGHT}px)`,
            gap: `${GAP}px`,
          }}
        >
          {Array.from({ length: columns * ROWS }).map((_, i) => {
            const columnIndex = i % columns;
            const isFilled = columnIndex < filledColumns;

            return (
              <div
                key={i}
                className={cn(
                  "",
                  isFilled ? (isOffline ? "bg-zinc-600" : "bg-zinc-100") : "bg-zinc-800"
                )}
              />
            );
          })}
        </div>
      </UsageCard>
    );
  }

  /* =========================
   * NORMAL VARIANTS
   * ========================= */
  return (
    <UsageCard
      title={labels.title}
      className={cn("flex h-full flex-col", isOffline && "opacity-60")}
    >
      {tooltipContent && <InfoTooltip content={tooltipContent} visible={!isEditing} />}

      <UsageCardContent
        className={cn("flex min-h-0 flex-1 flex-col !space-y-0", isXs ? "gap-1" : undefined)}
      >
        <div className="flex shrink-0 items-start justify-between">
          <div>
            <span
              className={cn(
                isOffline ? "text-zinc-500" : "text-zinc-100",
                primaryValue
                  ? isXs
                    ? "text-lg"
                    : isCompact
                      ? "text-xl"
                      : showCoreGrid
                        ? "text-xl"
                        : isLarge
                          ? "text-3xl"
                          : "text-2xl"
                  : isXs
                    ? "text-xl"
                    : isCompact
                      ? "text-2xl"
                      : showCoreGrid
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
          </div>
        </div>

        {showCoreGrid && coreUsage && (
          <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-1 shrink-0 text-[9px] font-medium text-zinc-500 uppercase">
              {labels.coreUsage}
            </div>
            <CpuCoreGrid cores={coreUsage} isOffline={isOffline} />
          </div>
        )}

        {history && !showCoreGrid && (
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

export default CpuCard;
