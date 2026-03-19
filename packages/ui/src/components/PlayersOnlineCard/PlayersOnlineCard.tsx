"use client";

import type { JSX } from "react";
import { cn } from "@stellarUI/lib/Utils";
import UsageCard, { UsageCardContent } from "../UsageCard/UsageCard";
import { AnimatedNumber } from "../AnimatedNumber/AnimatedNumber";
import { useDragDropGrid } from "../DragDropGrid/DragDropGrid";
import type {
  CardProps,
  Player,
  ContainerStatus,
  PlayersOnlineCardLabels,
} from "../DashboardCardsTypes/Types";

interface PlayersOnlineCardProps extends CardProps {
  isOffline: boolean;
  players: Player[];
  maxPlayers: number;
  containerStatus: ContainerStatus;
  labels: PlayersOnlineCardLabels;
}

const PlayersOnlineCard = ({
  itemId,
  isOffline,
  players,
  maxPlayers,
  containerStatus,
  labels,
}: PlayersOnlineCardProps): JSX.Element => {
  const { getItemSize } = useDragDropGrid();
  const size = getItemSize(itemId);

  const isXxs = size === "xxs" || size === "xxs-wide";
  const isXs = size === "xs";
  const isSm = size === "sm";

  const isRunning = containerStatus === "running";
  const maxVisible = isSm ? 8 : 4;
  const remainingCount = players.length - maxVisible;

  if (isXxs) {
    return (
      <UsageCard
        className={cn("flex h-full items-center justify-between px-6", isOffline && "opacity-60")}
      >
        <span className={cn("text-xs font-medium text-zinc-400 uppercase")}>
          {labels.titleShort}
        </span>
        <span className={cn("font-mono text-xl text-zinc-100")}>
          {isOffline || !isRunning ? (
            "--"
          ) : (
            <>
              <AnimatedNumber value={players.length} />/{maxPlayers}
            </>
          )}
        </span>
      </UsageCard>
    );
  }

  return (
    <UsageCard
      title={labels.title}
      className={cn("flex h-full flex-col", isOffline && "opacity-60")}
    >
      <UsageCardContent className={cn("flex flex-1 flex-col", isXs ? "space-y-1" : undefined)}>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-zinc-100", isXs ? "text-2xl" : "text-4xl")}>
            {isOffline || !isRunning ? "--" : <AnimatedNumber value={players.length} />}
          </span>
          <span className={cn("text-zinc-500", isXs ? "text-sm" : "text-lg")}>/{maxPlayers}</span>
        </div>

        {(isXs || isSm) && isRunning && players.length > 0 && (
          <div className={cn("mt-2 flex-1 overflow-hidden text-zinc-400")}>
            <div className={cn("mb-1 text-[10px] font-medium text-zinc-500 uppercase")}>
              {labels.online}
            </div>
            <div className="max-h-full space-y-0.5 overflow-y-auto">
              {players.slice(0, maxVisible).map((player) => (
                <div key={player.id} className={cn("truncate font-mono text-xs text-zinc-300")}>
                  {player.name}
                </div>
              ))}
              {remainingCount > 0 && (
                <div className={cn("text-[10px] text-zinc-500")}>+{remainingCount} more</div>
              )}
            </div>
          </div>
        )}
      </UsageCardContent>
    </UsageCard>
  );
};

export default PlayersOnlineCard;
