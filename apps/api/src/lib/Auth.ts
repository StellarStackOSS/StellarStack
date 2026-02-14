import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "./Db";
import { SendEmail } from "./Email";
import { TwoFactorCodeEmail } from "./EmailTemplates";
import { HashPassword, VerifyPassword } from "./Crypto";

const authConfig = {
  appName: "StellarStack",
  basePath: "/api/auth",
  baseURL: process.env.API_URL || "http://localhost:4000",
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Enable email verification in production for security
    requireEmailVerification: process.env.NODE_ENV === "production",
    // Use bcrypt for password hashing (compatible with SFTP auth and industry standard)
    password: {
      hash: HashPassword,
      verify: async ({ password, hash }) => VerifyPassword(password, hash),
    },
    // Send verification email on signup
    sendResetPassword: async ({ user, url }) => {
      const { SendEmail } = await import("./Email");
      await SendEmail({
        to: user.email,
        subject: "Reset your StellarStack password",
        html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
        text: `Reset your password: ${url}`,
      });
    },
  },
  plugins: [
    // captcha({
    //   provider: 'cloudflare-turnstile',
    //   secretKey: process.env.TURNSTILE_SECRET_KEY ?? ""
    // }),
    admin(),
    twoFactor({
      issuer: "StellarStack",
      otpOptions: {
        async sendOTP({ user, otp }) {
          const template = TwoFactorCodeEmail({
            name: user.name || user.email,
            code: otp,
          });
          await SendEmail({
            to: user.email,
            subject: "Your StellarStack verification code",
            html: template.html,
            text: template.text,
          });
        },
      },
    }),
    passkey({
      rpID: process.env.PASSKEY_RP_ID || "localhost",
      rpName: "StellarStack",
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
    }),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      enabled: !!process.env.DISCORD_CLIENT_ID,
    },
  },
  trustedOrigins: process.env.DESKTOP_MODE === "true"
    ? ["http://localhost:3000", "http://localhost:3001", "http://localhost:1420", "tauri://localhost"]
    : [process.env.FRONTEND_URL || "http://localhost:3000"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
      banned: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
} satisfies BetterAuthOptions;

// BetterAuth plugin type inference doesn't fully resolve with custom plugins,
// so we cast through unknown to the expected return type.
export const auth: ReturnType<typeof betterAuth> = betterAuth(authConfig) as unknown as ReturnType<typeof betterAuth>;

export type Auth = typeof auth;
