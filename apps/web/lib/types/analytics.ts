/**
 * @fileoverview Analytics types and interfaces for dashboard metrics
 * @module lib/types/analytics
 */

/**
 * Time range for analytics data
 */
export type AnalyticsTimeRange = '24h' | '7d' | '30d' | '90d' | '1y';

/**
 * Metric data point with timestamp
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * System-wide analytics metrics
 */
export interface SystemMetrics {
  totalServers: number;
  totalUsers: number;
  activeConnections: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  averageDiskUsage: number;
  uptime: number;
  totalNodes: number;
  healthyNodes: number;
}

/**
 * Node health and resource data
 */
export interface NodeMetrics {
  nodeId: string;
  nodeName: string;
  status: 'online' | 'offline' | 'degraded';
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  diskUsage: number;
  diskLimit: number;
  activeContainers: number;
  totalContainers: number;
  lastHeartbeat: number;
  uptime: number;
}

/**
 * Server resource metrics
 */
export interface ServerResourceMetrics {
  serverId: string;
  serverName: string;
  status: 'running' | 'stopped' | 'installing' | 'suspended' | 'error';
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  diskUsage: number;
  diskLimit: number;
  players?: number;
  fps?: number;
  tps?: number;
  uptime: number;
  lastUpdate: number;
}

/**
 * User activity metrics
 */
export interface UserActivityMetrics {
  userId: string;
  username: string;
  email: string;
  lastLogin: number;
  totalSessions: number;
  activityCount: number;
  serversManaged: number;
  isAdmin: boolean;
}

/**
 * Analytics time series data
 */
export interface TimeSeriesMetrics {
  dataPoints: MetricDataPoint[];
  average: number;
  min: number;
  max: number;
  peak: number;
}

/**
 * Backup storage analytics
 */
export interface BackupStorageMetrics {
  totalBackupSize: number;
  backupCount: number;
  averageBackupSize: number;
  oldestBackup: number;
  newestBackup: number;
  storageGrowthRate: number;
  estimatedCostPerMonth: number;
}

/**
 * Blueprint usage analytics
 */
export interface BlueprintUsageMetrics {
  blueprintId: string;
  blueprintName: string;
  usageCount: number;
  activeServers: number;
  category: string;
  popularity: number;
}

/**
 * API usage metrics
 */
export interface ApiUsageMetrics {
  totalRequests: number;
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    avgLatency: number;
  }>;
}

/**
 * Webhook delivery metrics
 */
export interface WebhookMetrics {
  totalWebhooks: number;
  totalDeliveries: number;
  successRate: number;
  averageDeliveryTime: number;
  failedDeliveries: number;
}

/**
 * Complete analytics dashboard data
 */
export interface AnalyticsDashboardData {
  timeRange: AnalyticsTimeRange;
  generatedAt: number;
  systemMetrics: SystemMetrics;
  nodeMetrics: NodeMetrics[];
  serverMetrics: ServerResourceMetrics[];
  userActivityMetrics: UserActivityMetrics[];
  cpuTimeSeries: TimeSeriesMetrics;
  memoryTimeSeries: TimeSeriesMetrics;
  diskTimeSeries: TimeSeriesMetrics;
  backupStorageMetrics: BackupStorageMetrics;
  blueprintMetrics: BlueprintUsageMetrics[];
  apiMetrics: ApiUsageMetrics;
  webhookMetrics: WebhookMetrics;
}

/**
 * Analytics comparison data for trending
 */
export interface AnalyticsComparison {
  current: number;
  previous: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Revenue and cost metrics for multi-tenant systems
 */
export interface FinancialMetrics {
  totalRevenue: number;
  costPerServer: number;
  costPerUser: number;
  profitMargin: number;
  invoicesPending: number;
  totalInvoicesThisMonth: number;
  paymentsPending: number;
}
