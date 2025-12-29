import { db } from "./db";
import crypto from "crypto";

/**
 * Webhook event types
 */
export const WebhookEvents = {
  // Server power events
  SERVER_STARTED: "server.started",
  SERVER_STOPPED: "server.stopped",
  SERVER_CRASHED: "server.crashed",
  SERVER_RESTARTED: "server.restarted",

  // Server lifecycle events
  SERVER_CREATED: "server.created",
  SERVER_DELETED: "server.deleted",
  SERVER_UPDATED: "server.updated",
  SERVER_SUSPENDED: "server.suspended",
  SERVER_UNSUSPENDED: "server.unsuspended",

  // Backup events
  BACKUP_CREATED: "backup.created",
  BACKUP_FAILED: "backup.failed",
  BACKUP_RESTORED: "backup.restored",
  BACKUP_DELETED: "backup.deleted",

  // Transfer events
  TRANSFER_STARTED: "transfer.started",
  TRANSFER_COMPLETED: "transfer.completed",
  TRANSFER_FAILED: "transfer.failed",

  // File events
  FILE_CREATED: "file.created",
  FILE_DELETED: "file.deleted",
  FILE_MODIFIED: "file.modified",

  // Resource events
  RESOURCE_WARNING: "resource.warning",
  RESOURCE_CRITICAL: "resource.critical",
} as const;

export type WebhookEvent = typeof WebhookEvents[keyof typeof WebhookEvents];

/**
 * Webhook payload structure
 */
interface WebhookPayload {
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
 * Generate HMAC-SHA256 signature for webhook payload
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Dispatch a webhook event
 */
export async function dispatchWebhook(
  event: WebhookEvent | string,
  options: {
    serverId?: string;
    userId?: string;
    data?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const { serverId, userId, data } = options;

  // Find all webhooks that should receive this event
  const webhooks = await db.webhook.findMany({
    where: {
      enabled: true,
      events: { has: event },
      OR: [
        { serverId: null }, // Global webhooks
        { serverId }, // Server-specific webhooks
      ],
      ...(userId ? { userId } : {}),
    },
    include: {
      server: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  if (webhooks.length === 0) {
    return;
  }

  // Get server info if serverId is provided
  let serverInfo;
  if (serverId) {
    const server = await db.server.findUnique({
      where: { id: serverId },
      select: { id: true, name: true, status: true },
    });
    if (server) {
      serverInfo = {
        id: server.id,
        name: server.name,
        status: server.status,
      };
    }
  }

  // Build the payload
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    ...(serverInfo && { server: serverInfo }),
    ...(data && { data }),
  };

  const payloadString = JSON.stringify(payload);

  // Dispatch to all matching webhooks
  const deliveryPromises = webhooks.map(async (webhook) => {
    const signature = signPayload(payloadString, webhook.secret);

    // Create delivery record
    const delivery = await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as object,
        attempts: 1,
      },
    });

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": event,
          "X-Webhook-Delivery": delivery.id,
          "User-Agent": "StellarStack-Webhook/1.0",
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseText = await response.text().catch(() => "");

      // Update delivery with result
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: response.status,
          response: responseText.substring(0, 5000), // Limit response size
          deliveredAt: response.ok ? new Date() : null,
        },
      });

      // If failed, schedule retry
      if (!response.ok) {
        scheduleRetry(delivery.id, 1);
      }
    } catch (error: any) {
      // Update delivery with error
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          response: error.message || "Request failed",
        },
      });

      // Schedule retry
      scheduleRetry(delivery.id, 1);
    }
  });

  // Execute all deliveries in parallel (fire and forget)
  await Promise.allSettled(deliveryPromises);
}

/**
 * Schedule a retry for a failed webhook delivery
 */
async function scheduleRetry(deliveryId: string, attemptNumber: number): Promise<void> {
  // Maximum 5 retry attempts
  if (attemptNumber >= 5) {
    return;
  }

  // Exponential backoff: 1min, 5min, 30min, 2hr
  const delays = [60000, 300000, 1800000, 7200000];
  const delay = delays[attemptNumber - 1] || delays[delays.length - 1];

  setTimeout(async () => {
    const delivery = await db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery || !delivery.webhook || !delivery.webhook.enabled) {
      return;
    }

    // Skip if already delivered
    if (delivery.deliveredAt) {
      return;
    }

    const payloadString = JSON.stringify(delivery.payload);
    const signature = signPayload(payloadString, delivery.webhook.secret);

    try {
      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: { attempts: attemptNumber + 1 },
      });

      const response = await fetch(delivery.webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": delivery.event,
          "X-Webhook-Delivery": deliveryId,
          "X-Webhook-Retry": String(attemptNumber),
          "User-Agent": "StellarStack-Webhook/1.0",
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000),
      });

      const responseText = await response.text().catch(() => "");

      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          statusCode: response.status,
          response: responseText.substring(0, 5000),
          deliveredAt: response.ok ? new Date() : null,
        },
      });

      if (!response.ok && attemptNumber < 4) {
        scheduleRetry(deliveryId, attemptNumber + 1);
      }
    } catch (error: any) {
      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          response: error.message || "Retry failed",
        },
      });

      if (attemptNumber < 4) {
        scheduleRetry(deliveryId, attemptNumber + 1);
      }
    }
  }, delay);
}

/**
 * Get all available webhook events
 */
export function getAvailableEvents(): string[] {
  return Object.values(WebhookEvents);
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = `sha256=${signPayload(payload, secret)}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
