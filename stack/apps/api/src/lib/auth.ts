import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "./db";
import { sendEmail } from "./email";
import { twoFactorCodeEmail } from "./email-templates";

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
    // Send verification email on signup
    sendResetPassword: async ({ user, url }) => {
      const { sendEmail } = await import("./email");
      await sendEmail({
        to: user.email,
        subject: "Reset your StellarStack password",
        html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
        text: `Reset your password: ${url}`,
      });
    },
  },
  plugins: [
    admin(),
    twoFactor({
      issuer: "StellarStack",
      otpOptions: {
        async sendOTP({ user, otp }) {
          const template = twoFactorCodeEmail({
            name: user.name || user.email,
            code: otp,
          });
          await sendEmail({
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
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: ReturnType<typeof betterAuth> = betterAuth(authConfig) as any;

export type Auth = typeof auth;
