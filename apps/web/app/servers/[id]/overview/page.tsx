"use client";

import { type JSX, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { servers } from "@/lib/api";
import { DragDropGrid, GridItem } from "@stellarUI/components/DragDropGrid/DragDropGrid";
import { useGridStorage } from "@stellarUI/hooks/useGridStorage";
import { Console } from "@stellarUI/components/Console/Console";
import { cn } from "@stellarUI/lib/utils";
import { BsExclamationTriangle } from "react-icons/bs";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { CpuCard } from "@stellarUI/components/CpuCard/CpuCard";
import { UsageMetricCard } from "@stellarUI/components/UsageMetricCard/UsageMetricCard";
import { NetworkUsageCard } from "@stellarUI/components/NetworkUsageCard/NetworkUsageCard";
import { SystemInformationCard } from "@stellarUI/components/SystemInformationCard/SystemInformationCard";
import { NetworkInfoCard } from "@stellarUI/components/NetworkInfoCard/NetworkInfoCard";
import { InstanceNameCard } from "@stellarUI/components/InstanceNameCard/InstanceNameCard";
import type { ContainerStatus } from "@stellarUI/components/dashboard-cards-types/dashboard-cards-types";
import { useLabels } from "@/hooks";
import { defaultGridItems, defaultHiddenCards } from "@/constants";
import { useServer } from "components/ServerStatusPages/server-provider";
import { type StatsWithHistory, useServerWebSocket } from "@/hooks/useServerWebSocket";
import { EulaExtension } from "../extensions/eula";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder";
import { ServerMaintenancePlaceholder } from "components/ServerStatusPages/server-maintenance-placeholder";
import { TextureButton } from "@stellarUI/components/TextureButton";
import { LightBoard } from "@stellarUI/components/LightBoard/LightBoard";
import ServerStatusBadge from "@/components/ServerStatusBadge/ServerStatusBadge";

const buildDisplayData = (server: any, statsData: StatsWithHistory, realDiskUsageBytes: number) => {
  const stats = statsData.current;

  const cpuPercent = stats?.cpu_absolute ?? 0;
  const cpuLimit = server?.cpu ?? 100;
  const memUsed = stats?.memory_bytes ? stats.memory_bytes / (1024 * 1024 * 1024) : 0;
  const memLimit = server?.memory ? server.memory / 1024 : 1;
  const memPercent = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;
  const diskUsed = realDiskUsageBytes / (1024 * 1024 * 1024);
  const diskLimit = server?.disk ? server.disk / 1024 : 10;
  const diskPercent = diskLimit > 0 ? (diskUsed / diskLimit) * 100 : 0;
  const netRxRate = statsData.networkRxRate ?? 0;
  const netTxRate = statsData.networkTxRate ?? 0;
  const uptime = stats?.uptime ?? 0;

  const getLocationString = () => {
    if (server?.node?.location) {
      const loc = server.node.location;
      const parts = [loc.city, loc.country].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : server.node.displayName;
    }
    return server?.node?.displayName || "Unknown";
  };

  return {
    name: server?.name || "Server",
    status: server?.status.toLowerCase() as ContainerStatus,
    cpu: {
      usage: { percentage: cpuPercent, history: statsData.cpuHistory },
      limit: cpuLimit,
      cores: Math.ceil((server?.cpu ?? 100) / 100),
      model: "CPU",
      architecture: "x86_64",
      baseFrequency: 3.5,
      boostFrequency: 4.5,
      tdp: 65,
      cache: "16MB",
      coreUsage: [] as { id: number; percentage: number; frequency: number }[],
      displayValue: `${cpuPercent.toFixed(0)}% / ${cpuLimit}%`,
    },
    memory: {
      usage: { percentage: memPercent, history: statsData.memoryPercentHistory },
      used: parseFloat(memUsed.toFixed(2)),
      total: parseFloat(memLimit.toFixed(2)),
      type: "",
      speed: 0,
      channels: "Dual",
      slots: "2/4",
      timings: "16-18-18-36",
      displayValue: `${memUsed.toFixed(2)} / ${memLimit.toFixed(2)} GiB`,
    },
    disk: {
      usage: { percentage: diskPercent, history: statsData.diskPercentHistory },
      used: parseFloat(diskUsed.toFixed(2)),
      total: parseFloat(diskLimit.toFixed(2)),
      type: "",
      model: "Storage",
      interface: "NVMe",
      readSpeed: "3500 MB/s",
      writeSpeed: "3000 MB/s",
      health: 100,
    },
    network: {
      download: Math.round(netRxRate / (1024 * 1024)),
      upload: Math.round(netTxRate / (1024 * 1024)),
      downloadHistory: statsData.networkRxHistory.map((b) => Math.round(b / (1024 * 1024))),
      uploadHistory: statsData.networkTxHistory.map((b) => Math.round(b / (1024 * 1024))),
    },
    networkConfig: {
      publicIp: server?.allocations?.[0]?.ip || "0.0.0.0",
      privateIp: "10.0.0.1",
      openPorts: server?.allocations?.map((a: any) => ({ port: a.port, protocol: "TCP" })) || [],
      macAddress: "00:00:00:00:00:00",
      ipAddress: server?.allocations?.[0]?.ip || "0.0.0.0",
      port: server?.allocations?.[0]?.port || 25565,
      interface: "eth0",
      adapter: "Virtual",
      speed: "1 Gbps",
      gateway: "10.0.0.1",
      dns: "8.8.8.8",
    },
    system: {
      os: "Linux",
      osVersion: "Debian 12",
    },
    node: server?.node
      ? {
          id: server.node.id || "unknown",
          shortId: server.node.shortId || server.node.id?.substring(0, 8) || "unknown",
          name: server.node.displayName || "Node",
          location: getLocationString(),
          region: server.node.location?.country || "Unknown",
          zone: server.node.location?.city || "Unknown",
          provider: "StellarStack",
        }
      : null,
    gameServer: {
      players: [] as { id: string; name: string; joinedAt: number }[],
      maxPlayers: 20,
    },
    containerUptime: uptime, // Uptime in seconds from daemon stats
    recentLogs: [] as { level: string; message: string; time: string }[],
  };
};

const ServerOverviewPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [showConnectionBanner, setShowConnectionBanner] = useState(false);
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);
  const labels = useLabels();

  const {
    server,
    consoleInfo,
    isLoading,
    isInstalling,
    start,
    stop,
    restart,
    kill,
    refetch,
    powerActionLoading,
  } = useServer();

  const wsEnabled = !!consoleInfo;

  const {
    lines: rawConsoleLines,
    stats: statsData,
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    sendCommand: sendConsoleCommand,
  } = useServerWebSocket({
    consoleInfo,
    enabled: wsEnabled,
  });

  const [realDiskUsageBytes, setRealDiskUsageBytes] = useState<number>(0);
  useEffect(() => {
    const fetchDiskUsage = async () => {
      const usage = await servers.files.diskUsage(serverId);
      setRealDiskUsageBytes(usage.used_bytes || 0);
    };

    fetchDiskUsage();
    const interval = setInterval(fetchDiskUsage, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [serverId]);

  const consoleLines = rawConsoleLines.map((line, index) => ({
    id: `${line.timestamp.getTime()}-${index}`,
    timestamp: line.timestamp.getTime(),
    level: (line.type === "error" || line.type === "stderr"
      ? "error"
      : line.type === "info"
        ? "info"
        : "default") as "info" | "error" | "default",
    message: line.text,
  }));

  // Delay showing connection banner to prevent flash on page load
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (wsEnabled && !hasAttemptedConnection) {
      setTimeout(() => setHasAttemptedConnection(true), 1000);
    }

    if (wsEnabled && !wsConnected && !wsConnecting && hasAttemptedConnection) {
      timeoutId = setTimeout(() => {
        setShowConnectionBanner(true);
      }, 3000);
    } else {
      setShowConnectionBanner(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [wsEnabled, wsConnected, wsConnecting, hasAttemptedConnection]);

  const { items, visibleItems, layouts, saveLayout, resetLayout, showCard, hideCard } =
    useGridStorage({
      key: `stellarstack-dashboard-layout-${serverId}`,
      defaultItems: defaultGridItems,
      defaultHiddenCards: defaultHiddenCards,
    });

  const displayData = buildDisplayData(server, statsData, realDiskUsageBytes);
  const isOffline = !server || server.status === "STOPPED" || server.status === "ERROR";

  const handleCommand = (command: string) => {
    sendConsoleCommand(command);
  };

  const containerControls = {
    status: displayData.status,
    handleStart: async () => {
      await start();
      await refetch();
    },
    handleStop: async () => {
      await stop();
      await refetch();
    },
    handleKill: async () => {
      await kill();
      await refetch();
    },
    handleRestart: async () => {
      await restart();
      await refetch();
    },
  };

  if (isInstalling) {
    return (
      <div className="min-h-svh bg-[#0b0b0a]">
        <ServerInstallingPlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh bg-[#0b0b0a]">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (server?.status === "MAINTENANCE") {
    return (
      <div className="min-h-svh bg-[#0b0b0a]">
        <ServerMaintenancePlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (isLoading && !wsConnected) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#0b0b0a]">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5" />
        </div>
      </div>
    );
  }

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        {showConnectionBanner && wsEnabled && !wsConnected && !wsConnecting && (
          <div className="relative z-10 flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <BsExclamationTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              Unable to connect to daemon. Server controls may not work until connection is
              restored.
            </span>
          </div>
        )}

        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger
                  className={cn(
                    "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
                  )}
                />
              </div>
              <div className="flex w-2/3 flex-row justify-end gap-2">
                <div className="flex flex-row items-center gap-2">
                  <TextureButton
                    variant={isEditing ? "primary" : "minimal"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="w-fit"
                  >
                    {isEditing ? labels.dashboard.doneEditing : labels.dashboard.editLayout}
                  </TextureButton>

                  {isEditing && (
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      onClick={() => resetLayout()}
                      className="w-fit"
                    >
                      Reset Layout
                    </TextureButton>
                  )}

                  <ServerStatusBadge server={server} />
                </div>
              </div>
            </div>
          </FadeIn>

          <DragDropGrid
            className="w-full"
            items={visibleItems}
            allItems={items}
            savedLayouts={layouts}
            onLayoutChange={saveLayout}
            onDropItem={(itemId) => showCard(itemId)}
            onRemoveItem={(itemId) => hideCard(itemId)}
            rowHeight={50}
            gap={16}
            isEditing={isEditing}
            isDroppable={true}
            removeConfirmLabels={labels.removeCard}
          >
            <div key="instance-name" className="h-full">
              <GridItem itemId="instance-name">
                <InstanceNameCard
                  itemId="instance-name"
                  instanceName={displayData.name}
                  isOffline={isOffline}
                  status={containerControls.status}
                  onStart={containerControls.handleStart}
                  onStop={containerControls.handleStop}
                  onKill={containerControls.handleKill}
                  onRestart={containerControls.handleRestart}
                  labels={labels.containerControls}
                  loadingStates={powerActionLoading}
                />
              </GridItem>
            </div>

            <div key="system-info" className="h-full">
              <GridItem itemId="system-info">
                <SystemInformationCard
                  itemId="system-info"
                  nodeData={displayData.node}
                  labels={labels.systemInfo}
                />
              </GridItem>
            </div>

            <div key="network-info" className="h-full">
              <GridItem itemId="network-info">
                <NetworkInfoCard
                  itemId="network-info"
                  networkInfo={{
                    publicIp: displayData.networkConfig.publicIp || "",
                    openPorts: displayData.networkConfig.openPorts,
                  }}
                  labels={labels.networkInfo}
                />
              </GridItem>
            </div>

            <div key="cpu" className="h-full">
              <GridItem itemId="cpu">
                <CpuCard
                  itemId="cpu"
                  percentage={displayData.cpu.usage.percentage}
                  primaryValue={displayData.cpu.displayValue}
                  history={displayData.cpu.usage.history}
                  coreUsage={displayData.cpu.coreUsage}
                  isOffline={isOffline}
                  labels={labels.cpu}
                />
              </GridItem>
            </div>

            <div key="ram" className="h-full">
              <GridItem itemId="ram">
                <UsageMetricCard
                  itemId="ram"
                  percentage={displayData.memory.usage.percentage}
                  primaryValue={displayData.memory.displayValue}
                  history={displayData.memory.usage.history}
                  isOffline={isOffline}
                  labels={labels.ram}
                />
              </GridItem>
            </div>

            <div key="disk" className="h-full">
              <GridItem itemId="disk">
                <UsageMetricCard
                  itemId="disk"
                  percentage={displayData.disk.usage.percentage}
                  primaryValue={`${displayData.disk.used.toFixed(2)} / ${displayData.disk.total.toFixed(0)} GiB`}
                  history={displayData.disk.usage.history}
                  isOffline={isOffline}
                  labels={labels.disk}
                />
              </GridItem>
            </div>

            <div key="network-usage" className="h-full">
              <GridItem itemId="network-usage">
                <NetworkUsageCard
                  itemId="network-usage"
                  download={displayData.network.download}
                  upload={displayData.network.upload}
                  downloadHistory={displayData.network.downloadHistory}
                  uploadHistory={displayData.network.uploadHistory}
                  isOffline={isOffline}
                  labels={labels.network}
                />
              </GridItem>
            </div>

            <div key="console" className="h-full">
              <GridItem itemId="console" showRemoveHandle={false}>
                <Console
                  lines={consoleLines}
                  onCommand={handleCommand}
                  isOffline={isOffline}
                  showSendButton={true}
                />
              </GridItem>
            </div>
          </DragDropGrid>
        </div>

        {/* Extensions */}
        <EulaExtension serverId={serverId} lines={rawConsoleLines} onRestart={restart} />
      </div>
    </FadeIn>
  );
};

export default ServerOverviewPage;
