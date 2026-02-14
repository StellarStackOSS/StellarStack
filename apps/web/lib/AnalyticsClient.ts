/**
 * @fileoverview Analytics API client for fetching dashboard metrics
 * @module lib/analytics-client
 */

import type {
  AnalyticsDashboardData,
  AnalyticsTimeRange,
  SystemMetrics,
  NodeMetrics,
  ServerResourceMetrics,
} from "@/lib/types/Analytics";
import { GetApiEndpoint } from '@/lib/PublicEnv';

/**
 * Make API request helper
 */
const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const config: RequestInit = {
    method: 'GET',
    credentials: 'include',
    ...options,
  };

  const response = await fetch(GetApiEndpoint(endpoint), config);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
};

/**
 * Analytics API client for dashboard metrics
 * Provides methods to fetch various analytics data
 */
class AnalyticsClient {

  /**
   * Fetch complete analytics dashboard data for specified time range
   * @param timeRange - Time range for analytics (24h, 7d, 30d, 90d, 1y)
   * @returns Promise with dashboard analytics data
   * @example
   * const data = await analyticsClient.getDashboardMetrics('7d');
   */
  async getDashboardMetrics(timeRange: AnalyticsTimeRange = '7d'): Promise<AnalyticsDashboardData> {
    return request<AnalyticsDashboardData>(`/api/analytics/dashboard?timeRange=${timeRange}`);
  }

  /**
   * Fetch system-wide metrics
   * @returns Promise with system metrics
   * @example
   * const metrics = await analyticsClient.getSystemMetrics();
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    return request<SystemMetrics>('/api/analytics/system-metrics');
  }

  /**
   * Fetch node health and resource metrics
   * @returns Promise with array of node metrics
   * @example
   * const nodes = await analyticsClient.getNodeMetrics();
   */
  async getNodeMetrics(): Promise<NodeMetrics[]> {
    return request<NodeMetrics[]>('/api/analytics/node-metrics');
  }

  /**
   * Fetch server resource metrics
   * @param nodeId - Optional filter by node ID
   * @returns Promise with array of server metrics
   * @example
   * const servers = await analyticsClient.getServerMetrics();
   * const nodeServers = await analyticsClient.getServerMetrics('node-1');
   */
  async getServerMetrics(nodeId?: string): Promise<ServerResourceMetrics[]> {
    const query = nodeId ? `?nodeId=${nodeId}` : '';
    return request<ServerResourceMetrics[]>(`/api/analytics/server-metrics${query}`);
  }

  /**
   * Fetch CPU usage time series data
   * @param timeRange - Time range for data points
   * @returns Promise with CPU metrics over time
   * @example
   * const cpuData = await analyticsClient.getCpuTimeSeries('24h');
   */
  async getCpuTimeSeries(timeRange: AnalyticsTimeRange = '7d') {
    return request(`/api/analytics/cpu-series?timeRange=${timeRange}`);
  }

  /**
   * Fetch memory usage time series data
   * @param timeRange - Time range for data points
   * @returns Promise with memory metrics over time
   * @example
   * const memoryData = await analyticsClient.getMemoryTimeSeries('24h');
   */
  async getMemoryTimeSeries(timeRange: AnalyticsTimeRange = '7d') {
    return request(`/api/analytics/memory-series?timeRange=${timeRange}`);
  }

  /**
   * Fetch disk usage time series data
   * @param timeRange - Time range for data points
   * @returns Promise with disk metrics over time
   * @example
   * const diskData = await analyticsClient.getDiskTimeSeries('30d');
   */
  async getDiskTimeSeries(timeRange: AnalyticsTimeRange = '7d') {
    return request(`/api/analytics/disk-series?timeRange=${timeRange}`);
  }

  /**
   * Fetch backup storage analytics
   * @returns Promise with backup metrics
   * @example
   * const backupMetrics = await analyticsClient.getBackupStorageMetrics();
   */
  async getBackupStorageMetrics() {
    return request('/api/analytics/backup-storage');
  }

  /**
   * Fetch blueprint usage analytics
   * @returns Promise with blueprint metrics
   * @example
   * const blueprints = await analyticsClient.getBlueprintMetrics();
   */
  async getBlueprintMetrics() {
    return request('/api/analytics/blueprint-metrics');
  }

  /**
   * Fetch API usage analytics
   * @returns Promise with API metrics
   * @example
   * const apiMetrics = await analyticsClient.getApiMetrics();
   */
  async getApiMetrics() {
    return request('/api/analytics/api-metrics');
  }

  /**
   * Fetch webhook delivery metrics
   * @returns Promise with webhook metrics
   * @example
   * const webhookMetrics = await analyticsClient.getWebhookMetrics();
   */
  async getWebhookMetrics() {
    return request('/api/analytics/webhook-metrics');
  }

  /**
   * Export analytics data in specified format
   * @param timeRange - Time range for export
   * @param format - Export format (csv, json, pdf)
   * @returns Promise with file blob
   * @example
   * const csvBlob = await analyticsClient.exportAnalytics('7d', 'csv');
   */
  async exportAnalytics(timeRange: AnalyticsTimeRange = '7d', format: 'csv' | 'json' | 'pdf' = 'csv') {
    return request(`/api/analytics/export?timeRange=${timeRange}&format=${format}`);
  }
}

export const analyticsClient = new AnalyticsClient();
