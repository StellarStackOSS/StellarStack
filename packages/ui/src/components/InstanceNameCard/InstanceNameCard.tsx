"use client";

import type { JSX } from "react";
import { cn } from "@stellarUI/lib/utils";
import UsageCard from "../UsageCard/UsageCard";
import type {
  CardProps,
  ContainerControlsCardLabels,
  ContainerStatus,
} from "../dashboard-cards-types/types";

interface InstanceNameCardProps extends CardProps {
  instanceName: string;
  isOffline: boolean;
  status: ContainerStatus;
  onStart: () => void;
  onStop: () => void;
  onKill: () => void;
  onRestart: () => void;
  labels: ContainerControlsCardLabels;
  loadingStates?: {
    start?: boolean;
    stop?: boolean;
    kill?: boolean;
    restart?: boolean;
  };
}

const InstanceNameCard = ({
  instanceName,
  isOffline,
  status,
  onStart,
  onStop,
  onKill,
  onRestart,
  loadingStates = {},
}: InstanceNameCardProps): JSX.Element => {
  const isRunning = status === "running";
  const isStarting = status === "starting";
  const isStopped = status === "stopped";
  const isStopping = status === "stopping";

  const isTransitioning = isStarting || isStopping;

  const anyLoading =
    loadingStates.start || loadingStates.stop || loadingStates.kill || loadingStates.restart;

  const startDisabled = isRunning || isTransitioning || anyLoading;
  const stopDisabled = isStopped || isOffline || isTransitioning || anyLoading;
  const killDisabled = isStopped || isOffline || isTransitioning || anyLoading;
  const restartDisabled = isStopped || isOffline || isTransitioning || anyLoading;

  const baseButtonClass = cn(
    "transition-opacity",
    isTransitioning ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-50"
  );


  return (
    <UsageCard className="flex h-full flex-row items-center justify-between">
      <div
        className={cn("font-mono text-2xl uppercase text-zinc-400")}
      >
        {instanceName}
      </div>

      <div className="flex flex-row gap-4">
        <span
          onClick={() => {
            if (isTransitioning || anyLoading) return;
            isRunning ? onStop() : onStart();
          }}
          className={baseButtonClass}
        >
          <img
            src={isRunning ? "/icons/30-media-pause.svg" : "/icons/30-media-play.svg"}
            alt={isRunning ? "pause_button" : "play_button"}
          />
        </span>
        <span
          onClick={() => !stopDisabled && onStop()}
          className={cn(stopDisabled ? "cursor-not-allowed opacity-50" : baseButtonClass)}
        >
          <img src="/icons/30-media-stop.svg" alt="stop_button" />
        </span>
        <span
          onClick={() => !killDisabled && onKill()}
          className={cn(killDisabled ? "cursor-not-allowed opacity-50" : baseButtonClass)}
        >
          <img src="/icons/30-xmark.svg" alt="kill_button" />
        </span>
        <span
          onClick={() => !restartDisabled && onRestart()}
          className={cn(restartDisabled ? "cursor-not-allowed opacity-50" : baseButtonClass)}
        >
          <img src="/icons/30-u-turn-to-left.svg" alt="restart_button" />
        </span>
      </div>
    </UsageCard>
  );
};

export default InstanceNameCard;
