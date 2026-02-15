/**
 * Type definitions for activity logging
 */

import { ActivityEvents } from "./Activity";

/**
 * Activity event type derived from ActivityEvents constant
 */
export type ActivityEvent = (typeof ActivityEvents)[keyof typeof ActivityEvents];

/**
 * Options for logging an activity
 */
export interface LogActivityOptions {
  event: ActivityEvent | string;
  serverId?: string;
  userId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Query parameters for activity logs
 */
export interface ActivityLogQuery {
  serverId?: string;
  userId?: string;
  event?: string;
  eventPrefix?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
