/**
 * Type definitions for email functionality
 */

/**
 * Email provider types
 */
export type EmailProvider = "resend" | "smtp" | "console";

/**
 * Email send options
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email configuration status
 */
export interface EmailConfigStatus {
  provider: EmailProvider;
  configured: boolean;
  details: Record<string, string | boolean>;
}
