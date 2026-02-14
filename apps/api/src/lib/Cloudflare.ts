/**
 * Cloudflare DNS API integration
 */

import { db } from "./Db";
import type { CloudflareSettings } from "../routes/SettingsTypes";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Get Cloudflare settings from the database.
 *
 * @returns The Cloudflare settings or defaults if not configured
 */
export const getCloudflareSettings = async (): Promise<CloudflareSettings> => {
  const setting = await db.settings.findUnique({
    where: { key: "cloudflare" },
  });

  const defaultSettings: CloudflareSettings = {
    apiToken: "",
    zoneId: "",
    domain: "",
    enabled: false,
  };

  if (!setting?.value) {
    return defaultSettings;
  }

  return setting.value as unknown as CloudflareSettings;
};

/**
 * Check if Cloudflare is configured and enabled.
 *
 * @returns Whether Cloudflare integration is enabled and has required credentials
 */
export const isCloudflareEnabled = async (): Promise<boolean> => {
  const settings = await getCloudflareSettings();
  return settings.enabled && !!settings.apiToken && !!settings.zoneId;
};

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

/**
 * Create a DNS A record for a subdomain pointing to an IP.
 *
 * @param subdomain - The subdomain to create the record for
 * @param targetIp - The IP address to point the record to
 * @param proxied - Whether to proxy the record through Cloudflare (default: true)
 * @returns Result object with success status and optional record ID or error
 */
export const createDnsRecord = async (
  subdomain: string,
  targetIp: string,
  proxied: boolean = true
): Promise<{ success: boolean; recordId?: string; error?: string }> => {
  const settings = await getCloudflareSettings();

  if (!settings.enabled || !settings.apiToken || !settings.zoneId) {
    return { success: false, error: "Cloudflare is not configured" };
  }

  const fullName = `${subdomain}.${settings.domain}`;

  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${settings.zoneId}/dns_records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "A",
        name: fullName,
        content: targetIp,
        proxied,
        ttl: proxied ? 1 : 300, // Auto TTL when proxied
      }),
    });

    const data: CloudflareResponse<DnsRecord> = await response.json();

    if (!data.success) {
      const errorMsg = data.errors?.[0]?.message || "Unknown Cloudflare error";
      console.error("Cloudflare API error:", data.errors);
      return { success: false, error: errorMsg };
    }

    return { success: true, recordId: data.result.id };
  } catch (error: unknown) {
    console.error("Failed to create Cloudflare DNS record:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Delete a DNS record by ID.
 *
 * @param recordId - The Cloudflare DNS record ID to delete
 * @returns Result object with success status and optional error
 */
export const deleteDnsRecord = async (
  recordId: string
): Promise<{ success: boolean; error?: string }> => {
  const settings = await getCloudflareSettings();

  if (!settings.enabled || !settings.apiToken || !settings.zoneId) {
    return { success: false, error: "Cloudflare is not configured" };
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${settings.zoneId}/dns_records/${recordId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data: CloudflareResponse<{ id: string }> = await response.json();

    if (!data.success) {
      const errorMsg = data.errors?.[0]?.message || "Unknown Cloudflare error";
      console.error("Cloudflare API error:", data.errors);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete Cloudflare DNS record:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Find a DNS record by name.
 *
 * @param subdomain - The subdomain to search for
 * @returns Result object with success status, optional DNS record, and optional error
 */
export const findDnsRecord = async (
  subdomain: string
): Promise<{ success: boolean; record?: DnsRecord; error?: string }> => {
  const settings = await getCloudflareSettings();

  if (!settings.enabled || !settings.apiToken || !settings.zoneId) {
    return { success: false, error: "Cloudflare is not configured" };
  }

  const fullName = `${subdomain}.${settings.domain}`;

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${settings.zoneId}/dns_records?name=${encodeURIComponent(fullName)}&type=A`,
      {
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data: CloudflareResponse<DnsRecord[]> = await response.json();

    if (!data.success) {
      const errorMsg = data.errors?.[0]?.message || "Unknown Cloudflare error";
      return { success: false, error: errorMsg };
    }

    if (data.result.length === 0) {
      return { success: true, record: undefined };
    }

    return { success: true, record: data.result[0] };
  } catch (error: unknown) {
    console.error("Failed to find Cloudflare DNS record:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Delete a DNS record by subdomain name (finds and deletes).
 *
 * @param subdomain - The subdomain whose DNS record should be deleted
 * @returns Result object with success status and optional error
 */
export const deleteDnsRecordByName = async (
  subdomain: string
): Promise<{ success: boolean; error?: string }> => {
  const findResult = await findDnsRecord(subdomain);

  if (!findResult.success) {
    return findResult;
  }

  if (!findResult.record) {
    // Record doesn't exist, consider it a success
    return { success: true };
  }

  return deleteDnsRecord(findResult.record.id);
};
