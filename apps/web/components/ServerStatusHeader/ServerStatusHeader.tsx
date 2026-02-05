"use client";

import type { JSX } from "react";
import { useServer } from "../ServerStatusPages/server-provider/server-provider";
import { TextureButton } from "@stellarUI/components/TextureButton";
import TextureBadge from "@stellarUI/components/TextureBadge/TextureBadge";
import {
  BsPlayFill,
  BsPauseFill,
  BsStopFill,
  BsArrowCounterclockwise,
} from "react-icons/bs";

/**
 * Converts server status to badge variant for display.
 *
 * @param status - The server status string
 * @returns Badge variant name
 */
const ConvertStatusToBadgeVariant = (
  status: string
): "success" | "destructive" | "warning" | "primary" => {
  switch (status.toLowerCase()) {
    case "running":
      return "success";
    case "stopped":
      return "destructive";
    case "starting":
    case "stopping":
      return "warning";
    default:
      return "primary";
  }
};

/**
 * Server status header displayed at the top of all server pages.
 * Shows server name, status badge, and action buttons (Start/Stop/Force Kill/Restart).
 *
 * @returns Server status header component
 */
const ServerStatusHeader = (): JSX.Element => {
  const { server, start, stop, restart, kill, powerActionLoading } = useServer();

  if (!server) {
    return <></>;
  }

  const status = server.status.toLowerCase() as "running" | "stopped" | "starting" | "stopping";
  const isRunning = status === "running";
  const isStopped = status === "stopped";
  const isStarting = status === "starting";
  const isStopping = status === "stopping";
  const isTransitioning = isStarting || isStopping;
  const isOffline = server.node?.status === "offline";

  const anyLoading =
    powerActionLoading.start ||
    powerActionLoading.stop ||
    powerActionLoading.kill ||
    powerActionLoading.restart;

  const startDisabled = isRunning || isTransitioning || anyLoading;
  const stopDisabled = isStopped || isOffline || isTransitioning || anyLoading;
  const killDisabled = isStopped || isOffline || isTransitioning || anyLoading;
  const restartDisabled = isStopped || isOffline || isTransitioning || anyLoading;

  const HandleStart = (): void => {
    if (!startDisabled) start();
  };

  const HandleStop = (): void => {
    if (!stopDisabled) stop();
  };

  const HandleKill = (): void => {
    if (!killDisabled) kill();
  };

  const HandleRestart = (): void => {
    if (!restartDisabled) restart();
  };

  return (
    <div className="border-b border-zinc-900 bg-zinc-950/50 px-6 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="font-mono text-lg uppercase text-zinc-300">{server.name}</div>
            <TextureBadge
              size="default"
              variant={ConvertStatusToBadgeVariant(server.status)}
            >
              {server.status}
            </TextureBadge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TextureButton
            variant={startDisabled ? "disabled" : "primary"}
            size="sm"
            onClick={HandleStart}
            disabled={startDisabled}
            title={startDisabled ? "Server is already running" : "Start server"}
            aria-label="Start server"
          >
            <BsPlayFill className="h-4 w-4" />
            <span className="text-xs">Start</span>
          </TextureButton>

          <TextureButton
            variant={stopDisabled ? "disabled" : "warning"}
            size="sm"
            onClick={HandleStop}
            disabled={stopDisabled}
            title={stopDisabled ? "Cannot stop server" : "Stop server"}
            aria-label="Stop server"
          >
            <BsPauseFill className="h-4 w-4" />
            <span className="text-xs">Stop</span>
          </TextureButton>

          <TextureButton
            variant={killDisabled ? "disabled" : "destructive"}
            size="sm"
            onClick={HandleKill}
            disabled={killDisabled}
            title={killDisabled ? "Cannot force kill server" : "Force kill server"}
            aria-label="Force kill server"
          >
            <BsStopFill className="h-4 w-4" />
            <span className="text-xs">Kill</span>
          </TextureButton>

          <TextureButton
            variant={restartDisabled ? "disabled" : "accent"}
            size="sm"
            onClick={HandleRestart}
            disabled={restartDisabled}
            title={restartDisabled ? "Cannot restart server" : "Restart server"}
            aria-label="Restart server"
          >
            <BsArrowCounterclockwise className="h-4 w-4" />
            <span className="text-xs">Restart</span>
          </TextureButton>
        </div>
      </div>
    </div>
  );
};

export default ServerStatusHeader;
