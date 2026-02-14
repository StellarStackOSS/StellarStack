/**
 * Email templates for StellarStack
 */

const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .card {
    background: #ffffff;
    border-radius: 8px;
    padding: 40px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  .logo {
    text-align: center;
    margin-bottom: 32px;
  }
  .logo h1 {
    font-size: 24px;
    font-weight: 700;
    color: #18181b;
    margin: 0;
    letter-spacing: -0.5px;
  }
  .logo span {
    color: #6366f1;
  }
  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #18181b;
    margin: 0 0 16px 0;
  }
  p {
    margin: 0 0 16px 0;
    color: #52525b;
  }
  .button {
    display: inline-block;
    background: #18181b;
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 32px;
    border-radius: 6px;
    font-weight: 500;
    margin: 16px 0;
  }
  .button:hover {
    background: #27272a;
  }
  .code {
    background: #f4f4f5;
    padding: 16px 24px;
    border-radius: 6px;
    font-family: monospace;
    font-size: 24px;
    letter-spacing: 4px;
    text-align: center;
    color: #18181b;
    margin: 16px 0;
  }
  .footer {
    text-align: center;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #e4e4e7;
  }
  .footer p {
    font-size: 12px;
    color: #a1a1aa;
  }
  .meta {
    background: #f9fafb;
    padding: 16px;
    border-radius: 6px;
    margin: 16px 0;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 14px;
  }
  .meta-label {
    color: #71717a;
  }
  .meta-value {
    color: #18181b;
    font-family: monospace;
  }
`;

const wrapTemplate = (content: string): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StellarStack</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>Stellar<span>Stack</span></h1>
      </div>
      ${content}
      <div class="footer">
        <p>This email was sent by StellarStack</p>
        <p>If you didn't request this email, you can safely ignore it.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
};

/**
 * Email verification template
 */
export const VerificationEmail = (params: {
  name: string;
  verificationUrl: string;
}): { html: string; text: string } => {
  const html = wrapTemplate(`
    <h2>Verify your email address</h2>
    <p>Hi ${params.name},</p>
    <p>Thanks for signing up for StellarStack! Please verify your email address by clicking the button below:</p>
    <p style="text-align: center;">
      <a href="${params.verificationUrl}" class="button">Verify Email Address</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 14px; color: #6366f1;">${params.verificationUrl}</p>
    <p>This link will expire in 24 hours.</p>
  `);

  const text = `
Verify your email address

Hi ${params.name},

Thanks for signing up for StellarStack! Please verify your email address by visiting this link:

${params.verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
`;

  return { html, text };
};

/**
 * Password reset template
 */
export const PasswordResetEmail = (params: {
  name: string;
  resetUrl: string;
}): { html: string; text: string } => {
  const html = wrapTemplate(`
    <h2>Reset your password</h2>
    <p>Hi ${params.name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p style="text-align: center;">
      <a href="${params.resetUrl}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 14px; color: #6366f1;">${params.resetUrl}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  `);

  const text = `
Reset your password

Hi ${params.name},

We received a request to reset your password. Visit this link to create a new password:

${params.resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
`;

  return { html, text };
};

/**
 * Two-factor authentication code template
 */
export const TwoFactorCodeEmail = (params: {
  name: string;
  code: string;
}): { html: string; text: string } => {
  const html = wrapTemplate(`
    <h2>Your verification code</h2>
    <p>Hi ${params.name},</p>
    <p>Use this code to complete your sign-in:</p>
    <div class="code">${params.code}</div>
    <p>This code will expire in 10 minutes.</p>
    <p>If you didn't try to sign in, please secure your account immediately by changing your password.</p>
  `);

  const text = `
Your verification code

Hi ${params.name},

Use this code to complete your sign-in:

${params.code}

This code will expire in 10 minutes.

If you didn't try to sign in, please secure your account immediately by changing your password.
`;

  return { html, text };
};

/**
 * Server alert/notification template
 */
export const ServerAlertEmail = (params: {
  name: string;
  serverName: string;
  alertType: "started" | "stopped" | "crashed" | "high_resource" | "backup_complete" | "backup_failed";
  details?: string;
  timestamp: string;
}): { html: string; text: string } => {
  const alertMessages: Record<string, { title: string; message: string; color: string }> = {
    started: { title: "Server Started", message: "Your server has been started successfully.", color: "#22c55e" },
    stopped: { title: "Server Stopped", message: "Your server has been stopped.", color: "#f59e0b" },
    crashed: { title: "Server Crashed", message: "Your server has crashed unexpectedly.", color: "#ef4444" },
    high_resource: { title: "High Resource Usage", message: "Your server is experiencing high resource usage.", color: "#f59e0b" },
    backup_complete: { title: "Backup Complete", message: "Your server backup has completed successfully.", color: "#22c55e" },
    backup_failed: { title: "Backup Failed", message: "Your server backup has failed.", color: "#ef4444" },
  };

  const alert = alertMessages[params.alertType];

  const html = wrapTemplate(`
    <h2 style="color: ${alert.color};">${alert.title}</h2>
    <p>Hi ${params.name},</p>
    <p>${alert.message}</p>
    <div class="meta">
      <div class="meta-row">
        <span class="meta-label">Server</span>
        <span class="meta-value">${params.serverName}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Time</span>
        <span class="meta-value">${params.timestamp}</span>
      </div>
      ${params.details ? `
      <div class="meta-row">
        <span class="meta-label">Details</span>
        <span class="meta-value">${params.details}</span>
      </div>
      ` : ""}
    </div>
    <p style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/servers" class="button">View Dashboard</a>
    </p>
  `);

  const text = `
${alert.title}

Hi ${params.name},

${alert.message}

Server: ${params.serverName}
Time: ${params.timestamp}
${params.details ? `Details: ${params.details}` : ""}

View your dashboard: ${process.env.FRONTEND_URL || "http://localhost:3000"}/servers
`;

  return { html, text };
};

/**
 * Welcome email template
 */
export const WelcomeEmail = (params: {
  name: string;
}): { html: string; text: string } => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const html = wrapTemplate(`
    <h2>Welcome to StellarStack!</h2>
    <p>Hi ${params.name},</p>
    <p>Thanks for joining StellarStack! We're excited to have you on board.</p>
    <p>Here's what you can do next:</p>
    <ul style="color: #52525b;">
      <li>Create your first server</li>
      <li>Explore our blueprints library</li>
      <li>Set up automatic backups</li>
      <li>Configure your server settings</li>
    </ul>
    <p style="text-align: center;">
      <a href="${frontendUrl}/servers" class="button">Get Started</a>
    </p>
    <p>If you have any questions, feel free to reach out to our support team.</p>
  `);

  const text = `
Welcome to StellarStack!

Hi ${params.name},

Thanks for joining StellarStack! We're excited to have you on board.

Here's what you can do next:
- Create your first server
- Explore our blueprints library
- Set up automatic backups
- Configure your server settings

Get started: ${frontendUrl}/servers

If you have any questions, feel free to reach out to our support team.
`;

  return { html, text };
};

/**
 * Account deletion template
 */
export const AccountDeletionEmail = (params: {
  name: string;
  deletionDate: string;
}): { html: string; text: string } => {
  const html = wrapTemplate(`
    <h2>Account Deleted</h2>
    <p>Hi ${params.name},</p>
    <p>Your StellarStack account has been deleted as requested.</p>
    <p>All your data, including servers and backups, have been permanently removed.</p>
    <div class="meta">
      <div class="meta-row">
        <span class="meta-label">Deletion Date</span>
        <span class="meta-value">${params.deletionDate}</span>
      </div>
    </div>
    <p>We're sorry to see you go. If you ever want to come back, you're always welcome to create a new account.</p>
  `);

  const text = `
Account Deleted

Hi ${params.name},

Your StellarStack account has been deleted as requested.

All your data, including servers and backups, have been permanently removed.

Deletion Date: ${params.deletionDate}

We're sorry to see you go. If you ever want to come back, you're always welcome to create a new account.
`;

  return { html, text };
};
