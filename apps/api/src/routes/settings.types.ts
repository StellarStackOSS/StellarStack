/**
 * Type definitions for settings routes
 */

/**
 * SMTP configuration
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

/**
 * Email configuration settings
 */
export interface EmailConfig {
  provider: "smtp" | "resend" | "sendgrid" | "mailgun";
  fromEmail: string;
  fromName: string;
  smtp: SmtpConfig | null;
  apiKey: string;
}

/**
 * Cloudflare settings
 */
export interface CloudflareSettings {
  apiToken: string;
  zoneId: string;
  domain: string;
  enabled: boolean;
}

/**
 * Subdomain settings
 */
export interface SubdomainSettings {
  enabled: boolean;
  baseDomain: string;
  autoProvision: boolean;
  dnsProvider: "cloudflare" | "manual";
}

/**
 * Branding settings
 */
export interface BrandingSettings {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  supportEmail: string;
  supportUrl: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  footerText: string;
  customCss?: string;
}
