"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stellarUI/components/Card/Card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@stellarUI/components/Chart/Chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import {
  BsGraphUp,
  BsArrowRepeat,
  BsDownload,
  BsServer,
  BsPeople,
  BsHdd,
  BsLink45Deg,
  BsCpu,
  BsMemory,
  BsDatabase,
} from "react-icons/bs";
import AnalyticsCard from "@/components/Analytics/AnalyticsCard";
import { analyticsClient } from "@/lib/analytics-client";
import type { AnalyticsTimeRange, AnalyticsDashboardData } from "@/lib/types/analytics";

/**
 * Time range selector options
 */
const TIME_RANGES: Array<{ label: string; value: AnalyticsTimeRange }> = [
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "1y" },
];

/**
 * Analytics Dashboard Page
 */
const AnalyticsDashboardPage: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<AnalyticsTimeRange>("7d");

  const { data, isLoading, refetch } = useQuery<AnalyticsDashboardData>({
    queryKey: ["analytics-dashboard", selectedTimeRange],
    queryFn: () => analyticsClient.getDashboardMetrics(selectedTimeRange),
  });

  const handleExport = async () => {
    try {
      const blob = await analyticsClient.exportAnalytics(selectedTimeRange, "csv");
      // @ts-ignore
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${selectedTimeRange}-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export analytics:", error);
    }
  };

  if (!data && isLoading) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (!data) {
    return (
      <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
          <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
            <FadeIn delay={0}>
              <div className="mb-6 flex items-center justify-between">
                <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              </div>
            </FadeIn>
            <FadeIn delay={0.05}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] py-12 shadow-lg shadow-black/20">
                  <BsGraphUp className="mb-4 h-12 w-12 text-zinc-600" />
                  <h3 className="mb-2 text-sm font-medium text-zinc-300">
                    Failed to Load Analytics
                  </h3>
                  <p className="text-xs text-zinc-500">Please try again.</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="minimal"
                  size="sm"
                  className="w-fit"
                  onClick={() => refetch()}
                >
                  <BsArrowRepeat className="h-4 w-4" />
                  Refresh
                </TextureButton>
                <TextureButton variant="minimal" size="sm" className="w-fit" onClick={handleExport}>
                  <BsDownload className="h-4 w-4" />
                  Export
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Time Range Selector */}
          <FadeIn delay={0.05}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {TIME_RANGES.map((range) => (
                <TextureButton
                  key={range.value}
                  variant={selectedTimeRange === range.value ? "primary" : "minimal"}
                  size="sm"
                  className="w-fit"
                  onClick={() => setSelectedTimeRange(range.value)}
                >
                  {range.label}
                </TextureButton>
              ))}
            </div>
          </FadeIn>

          {/* Analytics Content */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsGraphUp className="h-3 w-3" />
                  Analytics Dashboard
                </div>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                {/* System Metrics Cards */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    title="Total Servers"
                    value={data.systemMetrics.totalServers}
                    icon={<BsServer className="h-5 w-5 text-blue-400" />}
                  />
                  <MetricCard
                    title="Active Users"
                    value={data.systemMetrics.totalUsers}
                    icon={<BsPeople className="h-5 w-5 text-green-400" />}
                  />
                  <MetricCard
                    title="Connected Nodes"
                    value={`${data.systemMetrics.healthyNodes}/${data.systemMetrics.totalNodes}`}
                    icon={<BsHdd className="h-5 w-5 text-amber-400" />}
                  />
                  <MetricCard
                    title="Active Connections"
                    value={data.systemMetrics.activeConnections}
                    icon={<BsLink45Deg className="h-5 w-5 text-purple-400" />}
                  />
                </div>

                {/* Resource Usage Charts */}
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <CpuUsageChart data={data} />
                  <MemoryUsageChart data={data} />
                  <DiskUsageChart data={data} />
                </div>

                {/* Average Resource Usage */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <MetricCard
                    title="Avg CPU Usage"
                    value={`${data.systemMetrics.averageCpuUsage.toFixed(1)}%`}
                    icon={<BsCpu className="h-5 w-5 text-blue-400" />}
                  />
                  <MetricCard
                    title="Avg Memory Usage"
                    value={`${data.systemMetrics.averageMemoryUsage.toFixed(1)}%`}
                    icon={<BsMemory className="h-5 w-5 text-purple-400" />}
                  />
                  <MetricCard
                    title="Avg Disk Usage"
                    value={`${data.systemMetrics.averageDiskUsage.toFixed(1)}%`}
                    icon={<BsDatabase className="h-5 w-5 text-green-400" />}
                  />
                </div>

                {/* Node Health */}
                {data.nodeMetrics.length > 0 && <NodeHealthSection nodes={data.nodeMetrics} />}

                {/* Backup Storage */}
                <BackupStorageSection backup={data.backupStorageMetrics} />

                {/* API and Webhook Metrics */}
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <MetricCard
                    title="API Requests"
                    value={data.apiMetrics.totalRequests}
                    icon={<BsLink45Deg className="h-5 w-5 text-blue-400" />}
                  />
                  <MetricCard
                    title="Webhook Success Rate"
                    value={`${(data.webhookMetrics.successRate * 100).toFixed(1)}%`}
                    icon={<BsGraphUp className="h-5 w-5 text-green-400" />}
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </FadeIn>
  );
};

/**
 * Metric Card Component
 */
const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({
  title,
  value,
  icon,
}) => {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-900/50">
        {icon}
      </div>
      <div>
        <p className="text-xs text-zinc-500">{title}</p>
        <p className="text-xl font-semibold text-zinc-100">{value}</p>
      </div>
    </div>
  );
};

/**
 * CPU Usage Chart Component
 */
const CpuUsageChart: React.FC<{ data: AnalyticsDashboardData }> = ({ data }) => {
  const chartConfig = {
    cpu: {
      label: "CPU Usage",
      theme: {
        light: "#3b82f6",
        dark: "#60a5fa",
      },
    },
  } satisfies ChartConfig;

  return (
    <Card className="border-zinc-700/50 bg-zinc-800/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-100">CPU Usage Over Time</CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Average: {data.cpuTimeSeries.average.toFixed(1)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data.cpuTimeSeries.dataPoints}>
            <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="var(--color-cpu)" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Memory Usage Chart Component
 */
const MemoryUsageChart: React.FC<{ data: AnalyticsDashboardData }> = ({ data }) => {
  const chartConfig = {
    memory: {
      label: "Memory Usage",
      theme: {
        light: "#8b5cf6",
        dark: "#a78bfa",
      },
    },
  } satisfies ChartConfig;

  return (
    <Card className="border-zinc-700/50 bg-zinc-800/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-100">Memory Usage Over Time</CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Average: {data.memoryTimeSeries.average.toFixed(1)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data.memoryTimeSeries.dataPoints}>
            <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="var(--color-memory)" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Disk Usage Chart Component
 */
const DiskUsageChart: React.FC<{ data: AnalyticsDashboardData }> = ({ data }) => {
  const chartConfig = {
    disk: {
      label: "Disk Usage",
      theme: {
        light: "#10b981",
        dark: "#34d399",
      },
    },
  } satisfies ChartConfig;

  return (
    <Card className="border-zinc-700/50 bg-zinc-800/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-100">Disk Usage Over Time</CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Average: {data.diskTimeSeries.average.toFixed(1)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data.diskTimeSeries.dataPoints}>
            <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="var(--color-disk)" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Node Health Section Component
 */
const NodeHealthSection: React.FC<{ nodes: any[] }> = ({ nodes }) => {
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">Node Health</h3>
          <p className="text-xs text-zinc-500">{nodes.length} nodes available</p>
        </div>
      </div>
      <div className="space-y-3">
        {nodes.map((node) => (
          <div
            key={node.nodeId}
            className="flex items-center justify-between border-b border-zinc-800/50 pb-3 last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-medium text-zinc-200">{node.nodeName}</p>
              <p className="text-xs text-zinc-500">
                {node.activeContainers}/{node.totalContainers} containers running
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-300">
                CPU: <span className="font-medium">{node.cpuUsage.toFixed(1)}%</span>
              </p>
              <p className="text-xs text-zinc-500">
                Memory: {node.memoryUsage.toFixed(1)}GB / {node.memoryLimit.toFixed(1)}GB
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Backup Storage Section Component
 */
const BackupStorageSection: React.FC<{ backup: any }> = ({ backup }) => {
  return (
    <div className="mt-6 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-zinc-100">Backup Storage</h3>
        <p className="text-xs text-zinc-500">Storage utilization and costs</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs text-zinc-500">Total Size</p>
          <p className="text-lg font-semibold text-zinc-100">
            {(backup.totalBackupSize / 1024 / 1024 / 1024).toFixed(2)} GB
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Backup Count</p>
          <p className="text-lg font-semibold text-zinc-100">{backup.backupCount}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Est. Monthly Cost</p>
          <p className="text-lg font-semibold text-zinc-100">
            ${backup.estimatedCostPerMonth.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Loading skeleton for analytics dashboard
 */
const AnalyticsLoadingSkeleton: React.FC = () => (
  <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
    <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
        <FadeIn delay={0}>
          <div className="mb-6 flex items-center justify-between">
            <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
            <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
              <div className="flex items-center gap-2 text-xs opacity-50">
                <BsGraphUp className="h-3 w-3" />
                Analytics Dashboard
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] py-12 shadow-lg shadow-black/20">
              <Spinner className="h-8 w-8" />
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  </FadeIn>
);

export default AnalyticsDashboardPage;
