import nodemailer from "nodemailer";

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
 * Get the configured email provider
 */
function getProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (provider === "resend") return "resend";
  if (provider === "smtp") return "smtp";
  return "console"; // Default to console logging in development
}

/**
 * Get the default from address
 */
function getDefaultFrom(): string {
  return process.env.EMAIL_FROM || "StellarStack <noreply@stellarstack.io>";
}

/**
 * Send email via Resend API
 */
async function sendViaResend(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from || getDefaultFrom(),
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "Failed to send email via Resend" };
    }

    const result = await response.json();
    return { success: true, messageId: result.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send email via SMTP
 */
async function sendViaSMTP(options: EmailOptions): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return { success: false, error: "SMTP_HOST not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    const info = await transporter.sendMail({
      from: options.from || getDefaultFrom(),
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Console logger for development
 */
async function sendViaConsole(options: EmailOptions): Promise<EmailResult> {
  console.log("=== Email (Console Provider) ===");
  console.log(`To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`From: ${options.from || getDefaultFrom()}`);
  console.log("---");
  console.log(options.text || "No text version");
  console.log("================================");

  return { success: true, messageId: `console-${Date.now()}` };
}

/**
 * Send an email using the configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = getProvider();

  switch (provider) {
    case "resend":
      return sendViaResend(options);
    case "smtp":
      return sendViaSMTP(options);
    case "console":
    default:
      return sendViaConsole(options);
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfig(): Promise<EmailResult> {
  const provider = getProvider();
  const testAddress = process.env.EMAIL_TEST_ADDRESS || "test@example.com";

  return sendEmail({
    to: testAddress,
    subject: "StellarStack Email Test",
    html: `
      <h1>Email Configuration Test</h1>
      <p>This is a test email from StellarStack.</p>
      <p><strong>Provider:</strong> ${provider}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    `,
    text: `Email Configuration Test\n\nThis is a test email from StellarStack.\nProvider: ${provider}\nTime: ${new Date().toISOString()}`,
  });
}

/**
 * Get email configuration status
 */
export function getEmailConfigStatus(): {
  provider: EmailProvider;
  configured: boolean;
  details: Record<string, string | boolean>;
} {
  const provider = getProvider();

  switch (provider) {
    case "resend":
      return {
        provider,
        configured: !!process.env.RESEND_API_KEY,
        details: {
          hasApiKey: !!process.env.RESEND_API_KEY,
          from: getDefaultFrom(),
        },
      };
    case "smtp":
      return {
        provider,
        configured: !!process.env.SMTP_HOST,
        details: {
          host: process.env.SMTP_HOST || "(not set)",
          port: process.env.SMTP_PORT || "587",
          secure: process.env.SMTP_SECURE === "true",
          hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
          from: getDefaultFrom(),
        },
      };
    case "console":
    default:
      return {
        provider: "console",
        configured: true,
        details: {
          note: "Console logging mode - emails are logged to stdout",
          from: getDefaultFrom(),
        },
      };
  }
}
