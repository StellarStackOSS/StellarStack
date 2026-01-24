'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@workspace/ui/components/chart';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Button } from '@workspace/ui/components/button';
import { Download, RefreshCw } from 'lucide-react';
import AnalyticsCard from '@/components/Analytics/AnalyticsCard';
import { analyticsClient } from '@/lib/analytics-client';
import type { AnalyticsTimeRange, AnalyticsDashboardData } from '@/lib/types/analytics';
import PageHeader from '@/components/PageHeader';

/**
 * Time range selector options
 */
const TIME_RANGES: Array<{ label: string; value: AnalyticsTimeRange }> = [
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' },
];

/**
 * Analytics Dashboard Page
 *
 * Displays comprehensive system analytics including:
 * - System-wide metrics (servers, users, nodes)
 * - Resource usage trends (CPU, memory, disk)
 * - Node health and utilization
 * - Server metrics and distribution
 * - Backup storage analytics
 * - Blueprint usage statistics
 *
 * @component
 */
const AnalyticsDashboardPage: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<AnalyticsTimeRange>('7d');

  /**
   * Fetch analytics dashboard data
   */
  const { data, isLoading, refetch } = useQuery<AnalyticsDashboardData>({
    queryKey: ['analytics-dashboard', selectedTimeRange],
    queryFn: () => analyticsClient.getDashboardMetrics(selectedTimeRange),
  });

  /**
   * Handle export analytics data
   */
  const handleExport = async () => {
    try {
      const blob = await analyticsClient.exportAnalytics(selectedTimeRange, 'csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${selectedTimeRange}-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  if (!data && isLoading) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics Dashboard" description="System metrics and insights" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Failed to load analytics data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard" description="System metrics and insights" />

      {/* Time Range and Export Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={selectedTimeRange === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* System Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Total Servers"
          value={data.systemMetrics.totalServers}
          unit="servers"
          icon={<span>🖥️</span>}
        />
        <AnalyticsCard
          title="Active Users"
          value={data.systemMetrics.totalUsers}
          unit="users"
          icon={<span>👥</span>}
        />
        <AnalyticsCard
          title="Connected Nodes"
          value={`${data.systemMetrics.healthyNodes}/${data.systemMetrics.totalNodes}`}
          unit="nodes"
          icon={<span>⚙️</span>}
        />
        <AnalyticsCard
          title="Active Connections"
          value={data.systemMetrics.activeConnections}
          unit="connections"
          icon={<span>🔗</span>}
        />
      </div>

      {/* Resource Usage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CpuUsageChart data={data} />
        <MemoryUsageChart data={data} />
        <DiskUsageChart data={data} />
      </div>

      {/* Average Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnalyticsCard
          title="Avg CPU Usage"
          value={data.systemMetrics.averageCpuUsage.toFixed(1)}
          unit="%"
          icon={<span>📊</span>}
        />
        <AnalyticsCard
          title="Avg Memory Usage"
          value={data.systemMetrics.averageMemoryUsage.toFixed(1)}
          unit="%"
          icon={<span>💾</span>}
        />
        <AnalyticsCard
          title="Avg Disk Usage"
          value={data.systemMetrics.averageDiskUsage.toFixed(1)}
          unit="%"
          icon={<span>💿</span>}
        />
      </div>

      {/* Node Health */}
      {data.nodeMetrics.length > 0 && <NodeHealthSection nodes={data.nodeMetrics} />}

      {/* Backup Storage */}
      <BackupStorageSection backup={data.backupStorageMetrics} />

      {/* API and Webhook Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnalyticsCard
          title="API Requests"
          value={data.apiMetrics.totalRequests}
          unit="requests"
          icon={<span>🔌</span>}
        />
        <AnalyticsCard
          title="Webhook Success Rate"
          value={`${(data.webhookMetrics.successRate * 100).toFixed(1)}`}
          unit="%"
          icon={<span>🪝</span>}
        />
      </div>
    </div>
  );
};

/**
 * CPU Usage Chart Component
 * @param data - Analytics dashboard data
 */
const CpuUsageChart: React.FC<{ data: AnalyticsDashboardData }> = ({ data }) => {
  const chartConfig = {
    cpu: {
      label: 'CPU Usage',
      theme: {
        light: '#3b82f6',
        dark: '#60a5fa',
      },
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">CPU Usage Over Time</CardTitle>
        <CardDescription>Average: {data.cpuTimeSeries.average.toFixed(1)}%</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data.cpuTimeSeries.dataPoints}>
            <CartesianGrid strokeDasharray="2 2" />
            <XAxis dataKey="label" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="var(--color-cpu)" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Memory Usage Chart Component
 * @param data - Analytics dashboard data
 */
const MemoryUsageChart: React.FC<{ data: AnalyticsDashboardData }> = ({ data }) => {
  const chartConfig = {
    memory: {
      label: 'Memory Usage',
      theme: {
        light: '#8b5cf6',
        dark: '#a78bfa',
      },
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Memory Usage Over Time</CardTitle>
        <CardDescription>Average: {data.memoryTimeSeries.average.toFixed(1)}%</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data.memoryTimeSeries.dataPoints}>
            <CartesianGrid strokeDasharray="2 2" />
            <XAxis dataKey="label" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="var(--color-memory)" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Disk Usage Chart Component
 * @param data - Analytics dashboard data
 */
const DiskUsageChart: React.FC<{ data: AnalyticsDashboardData }> = ({ data }) => {
  const chartConfig = {
    disk: {
      label: 'Disk Usage',
      theme: {
        light: '#10b981',
        dark: '#34d399',
      },
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Disk Usage Over Time</CardTitle>
        <CardDescription>Average: {data.diskTimeSeries.average.toFixed(1)}%</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data.diskTimeSeries.dataPoints}>
            <CartesianGrid strokeDasharray="2 2" />
            <XAxis dataKey="label" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="var(--color-disk)" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Node Health Section Component
 * @param nodes - Array of node metrics
 */
const NodeHealthSection: React.FC<{ nodes: any[] }> = ({ nodes }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Node Health</CardTitle>
        <CardDescription>{nodes.length} nodes available</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {nodes.map((node) => (
            <div key={node.nodeId} className="flex items-center justify-between border-b pb-3 last:border-b-0">
              <div>
                <p className="font-medium text-sm">{node.nodeName}</p>
                <p className="text-xs text-muted-foreground">
                  {node.activeContainers}/{node.totalContainers} containers running
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm">
                  CPU: <span className="font-medium">{node.cpuUsage.toFixed(1)}%</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Memory: {node.memoryUsage.toFixed(1)}GB / {node.memoryLimit.toFixed(1)}GB
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Backup Storage Section Component
 * @param backup - Backup storage metrics
 */
const BackupStorageSection: React.FC<{ backup: any }> = ({ backup }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Backup Storage</CardTitle>
        <CardDescription>Storage utilization and costs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Size</p>
            <p className="text-lg font-semibold">{(backup.totalBackupSize / 1024 / 1024 / 1024).toFixed(2)} GB</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Backup Count</p>
            <p className="text-lg font-semibold">{backup.backupCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. Monthly Cost</p>
            <p className="text-lg font-semibold">${backup.estimatedCostPerMonth.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Loading skeleton for analytics dashboard
 */
const AnalyticsLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    <PageHeader title="Analytics Dashboard" description="System metrics and insights" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="h-4 bg-muted rounded w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export default AnalyticsDashboardPage;
