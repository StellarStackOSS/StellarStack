/**
 * Type definitions for webhooks
 */

import { WebhookEvents } from "./Webhooks";

/**
 * Webhook event type derived from WebhookEvents constant
 */
export type WebhookEvent = (typeof WebhookEvents)[keyof typeof WebhookEvents];

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: string;
  timestamp: string;
  server?: {
    id: string;
    name: string;
    status?: string;
  };
  data?: Record<string, unknown>;
}

/**
 * Options for dispatching a webhook
 */
export interface DispatchWebhookOptions {
  serverId?: string;
  userId?: string;
  data?: Record<string, unknown>;
}
