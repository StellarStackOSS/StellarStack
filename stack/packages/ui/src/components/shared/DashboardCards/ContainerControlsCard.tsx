"use client";

import type { JSX } from "react";
import { cn } from "../../../lib/utils";
import { UsageCard } from "../UsageCard/UsageCard";
import type { CardProps, ContainerStatus, ContainerControlsCardLabels } from "./types";

// Simple spinner component
const ButtonSpinner = ({ isDark }: { isDark: boolean }) => (
  <svg
    className={cn("animate-spin h-3 w-3", isDark ? "text-zinc-400" : "text-zinc-500")}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

interface ContainerControlsCardProps extends CardProps {
  isDark: boolean;
  isOffline: boolean;
  status: ContainerStatus;
  onStart: () => void;
  onStop: () => void;
  onKill: () => void;
  onRestart: () => void;
  labels: ContainerControlsCardLabels;
  /** Optional loading states for each action */
  loadingStates?: {
    start?: boolean;
    stop?: boolean;
    kill?: boolean;
    restart?: boolean;
  };
}

export const ContainerControlsCard = ({
  isDark,
  isOffline,
  status,
  onStart,
  onStop,
  onKill,
  onRestart,
  labels,
  loadingStates = {},
}: ContainerControlsCardProps): JSX.Element => {
  const isRunning = status === "running";
  const isStarting = status === "starting";
  const isStopped = status === "stopped";
  const isStopping = status === "stopping";

  // Check if any action is loading
  const anyLoading = loadingStates.start || loadingStates.stop || loadingStates.kill || loadingStates.restart;

  const buttonBase = "px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors border bg-transparent flex items-center justify-center gap-2 min-w-[80px]";
  const buttonColors = isDark
    ? "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-800";
  const disabledColors = isDark
    ? "border-zinc-800 text-zinc-600"
    : "border-zinc-200 text-zinc-400";
  const loadingColors = isDark
    ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
    : "border-amber-500/50 text-amber-600 bg-amber-50";

  // Start: disabled when running, starting, stopping, or any action loading
  const startDisabled = isRunning || isStarting || isStopping || anyLoading;
  // Stop: enabled when running or starting (can stop a starting server)
  const stopDisabled = isStopped || isStopping || isOffline || anyLoading;
  // Kill: always available when not stopped (force kill even during transitions)
  const killDisabled = isStopped || isOffline || anyLoading;
  // Restart: disabled during transitions
  const restartDisabled = isStopped || isStarting || isStopping || isOffline || anyLoading;

  return (
    <UsageCard isDark={isDark} className="h-full flex items-center justify-center px-8">
      <div className="flex gap-4 w-full justify-between max-w-md">
        <button
          onClick={onStart}
          disabled={startDisabled}
          className={cn(
            buttonBase,
            loadingStates.start ? loadingColors : (startDisabled ? disabledColors : buttonColors),
            startDisabled && "cursor-not-allowed"
          )}
        >
          {loadingStates.start && <ButtonSpinner isDark={isDark} />}
          {loadingStates.start ? "Starting..." : (isStarting ? "Starting..." : labels.start)}
        </button>
        <button
          onClick={onStop}
          disabled={stopDisabled}
          className={cn(
            buttonBase,
            loadingStates.stop ? loadingColors : (stopDisabled ? disabledColors : buttonColors),
            stopDisabled && "cursor-not-allowed"
          )}
        >
          {loadingStates.stop && <ButtonSpinner isDark={isDark} />}
          {loadingStates.stop ? "Stopping..." : (isStopping ? "Stopping..." : labels.stop)}
        </button>
        <button
          onClick={onKill}
          disabled={killDisabled}
          className={cn(
            buttonBase,
            loadingStates.kill ? loadingColors : (killDisabled ? disabledColors : buttonColors),
            killDisabled && "cursor-not-allowed"
          )}
        >
          {loadingStates.kill && <ButtonSpinner isDark={isDark} />}
          {loadingStates.kill ? "Killing..." : labels.kill}
        </button>
        <button
          onClick={onRestart}
          disabled={restartDisabled}
          className={cn(
            buttonBase,
            loadingStates.restart ? loadingColors : (restartDisabled ? disabledColors : buttonColors),
            restartDisabled && "cursor-not-allowed"
          )}
        >
          {loadingStates.restart && <ButtonSpinner isDark={isDark} />}
          {loadingStates.restart ? "Restarting..." : labels.restart}
        </button>
      </div>
    </UsageCard>
  );
};
