import type { OpenAPIV3_1 } from "./types.js";

export const openApiSpec: OpenAPIV3_1.Document = {
  openapi: "3.1.0",
  info: {
    title: "StellarStack API",
    version: "1.3.9",
    description:
      "StellarStack is a modern game server management panel. This API documentation covers all panel endpoints including authentication (powered by better-auth), server management, node management, file operations, backups, webhooks, and administration.",
    contact: {
      name: "StellarStack",
    },
    license: {
      name: "MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Health", description: "Health check and status endpoints" },
    { name: "Setup", description: "First-time setup and password recovery" },
    { name: "Auth", description: "Authentication endpoints (better-auth)" },
    { name: "Two-Factor", description: "Two-factor authentication (TOTP & OTP)" },
    { name: "Passkeys", description: "WebAuthn passkey authentication" },
    { name: "OAuth", description: "Social login providers (Google, GitHub, Discord)" },
    { name: "Account", description: "User profile and account management" },
    { name: "Admin Users", description: "Admin user management" },
    { name: "Admin Email", description: "Admin email configuration" },
    { name: "Locations", description: "Location (datacenter region) management" },
    { name: "Nodes", description: "Node (daemon host) management" },
    { name: "Node Allocations", description: "Port allocation management on nodes" },
    { name: "Node Daemon", description: "Daemon handshake, heartbeat, and status reporting" },
    { name: "Blueprints", description: "Blueprint (game egg) management" },
    { name: "Servers", description: "Game server CRUD and power actions" },
    { name: "Server Startup", description: "Server startup configuration and variables" },
    { name: "Server Files", description: "File management on game servers" },
    { name: "Server Backups", description: "Backup creation, restoration, and management" },
    { name: "Server Schedules", description: "Scheduled task management" },
    { name: "Server Allocations", description: "Server port allocation management" },
    { name: "Server Activity", description: "Server activity logs" },
    { name: "Server Splitting", description: "Split server resources into child servers" },
    { name: "Server Transfer", description: "Transfer servers between nodes" },
    { name: "Server Settings", description: "Server settings (MOTD, etc.)" },
    { name: "Firewall", description: "Server firewall rules" },
    { name: "Subdomains", description: "Server subdomain management" },
    { name: "Custom Domains", description: "Server custom domain management" },
    { name: "Members", description: "Server member (subuser) management" },
    { name: "Invitations", description: "Server invitation management" },
    { name: "Webhooks", description: "Webhook CRUD and delivery management" },
    {
      name: "Admin Settings",
      description: "Panel settings (Cloudflare, subdomains, email, branding)",
    },
    { name: "Analytics", description: "Admin analytics and metrics" },
    { name: "Remote", description: "Daemon-to-panel communication (internal)" },
    { name: "Features", description: "Feature flags" },
    { name: "WebSocket", description: "Real-time WebSocket endpoints" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Session cookie set by better-auth after sign-in",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Bearer token for daemon authentication. Format: `{token_id}.{token}`",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      ValidationError: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["error"],
      },
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          emailVerified: { type: "boolean" },
          image: { type: "string", format: "uri", nullable: true },
          role: { type: "string", enum: ["user", "admin"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Location: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          country: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Node: {
        type: "object",
        properties: {
          id: { type: "string" },
          displayName: { type: "string" },
          host: { type: "string" },
          port: { type: "integer" },
          protocol: { type: "string", enum: ["HTTP", "HTTPS", "HTTPS_PROXY"] },
          sftpPort: { type: "integer" },
          memoryLimit: { type: "string", description: "BigInt as string (bytes)" },
          diskLimit: { type: "string", description: "BigInt as string (bytes)" },
          cpuLimit: { type: "number" },
          uploadLimit: { type: "string", description: "BigInt as string (bytes)" },
          isOnline: { type: "boolean" },
          lastHeartbeat: { type: "string", format: "date-time", nullable: true },
          location: { $ref: "#/components/schemas/Location" },
        },
      },
      Allocation: {
        type: "object",
        properties: {
          id: { type: "string" },
          ip: { type: "string" },
          port: { type: "integer" },
          alias: { type: "string", nullable: true },
          assigned: { type: "boolean" },
          nodeId: { type: "string" },
          serverId: { type: "string", nullable: true },
        },
      },
      Blueprint: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          category: { type: "string", nullable: true },
          author: { type: "string", nullable: true },
          dockerImages: { type: "object", additionalProperties: { type: "string" } },
          startup: { type: "string" },
          config: { type: "object" },
          scripts: { type: "object" },
          variables: { type: "array", items: { type: "object" } },
          features: { type: "array", items: { type: "string" } },
          fileDenylist: { type: "array", items: { type: "string" } },
          dockerConfig: { type: "object" },
          isPublic: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Server: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: [
              "INSTALLING",
              "STARTING",
              "RUNNING",
              "STOPPING",
              "STOPPED",
              "SUSPENDED",
              "MAINTENANCE",
              "RESTORING",
              "ERROR",
            ],
          },
          memory: { type: "string", description: "BigInt as string (MiB)" },
          disk: { type: "string", description: "BigInt as string (MiB)" },
          cpu: { type: "number", description: "Percentage (100 = 1 core)" },
          swap: { type: "string", description: "BigInt as string (MiB)" },
          nodeId: { type: "string" },
          blueprintId: { type: "string" },
          ownerId: { type: "string" },
          dockerImage: { type: "string", nullable: true },
          suspended: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          enabled: { type: "boolean" },
          provider: { type: "string" },
          userId: { type: "string" },
          serverId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Backup: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          size: { type: "number" },
          checksum: { type: "string", nullable: true },
          checksumType: { type: "string" },
          status: { type: "string", enum: ["IN_PROGRESS", "COMPLETED", "FAILED", "RESTORING"] },
          isLocked: { type: "boolean" },
          serverId: { type: "string" },
          ignoredFiles: { type: "array", items: { type: "string" } },
          completedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Schedule: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          cronExpression: { type: "string" },
          isActive: { type: "boolean" },
          lastRunAt: { type: "string", format: "date-time", nullable: true },
          serverId: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                action: {
                  type: "string",
                  enum: ["power_start", "power_stop", "power_restart", "backup", "command"],
                },
                payload: { type: "string", nullable: true },
                timeOffset: { type: "integer" },
                sequence: { type: "integer" },
                triggerMode: { type: "string", enum: ["TIME_DELAY", "ON_COMPLETION"] },
              },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      FirewallRule: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          direction: { type: "string", enum: ["INBOUND", "OUTBOUND"] },
          action: { type: "string", enum: ["ALLOW", "DENY"] },
          port: { type: "integer" },
          protocol: { type: "string", enum: ["tcp", "udp", "both"] },
          sourceIp: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          serverId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      FileEntry: {
        type: "object",
        properties: {
          name: { type: "string" },
          path: { type: "string" },
          type: { type: "string", enum: ["file", "directory"] },
          size: { type: "number" },
          modified: { type: "string", format: "date-time" },
          permissions: { type: "string" },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    // ==================== Health & Setup ====================
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/status": {
      get: {
        tags: ["Setup"],
        summary: "Get setup status",
        description: "Check if the system is initialized and has an admin user.",
        security: [],
        responses: {
          "200": {
            description: "Setup status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    initialized: { type: "boolean" },
                    hasAdmin: { type: "boolean" },
                    userCount: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/setup": {
      post: {
        tags: ["Setup"],
        summary: "First-time setup",
        description: "Create the initial admin account. Only works when no users exist.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Admin account created" },
          "400": { description: "System already initialized or validation error" },
        },
      },
    },
    "/api/admin/reset-password": {
      post: {
        tags: ["Setup"],
        summary: "Admin password recovery",
        description: "Reset a user's password using ADMIN_RECOVERY_KEY environment variable.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "newPassword", "recoveryKey"],
                properties: {
                  email: { type: "string", format: "email" },
                  newPassword: { type: "string", minLength: 8 },
                  recoveryKey: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset successfully" },
          "403": { description: "Invalid recovery key or feature disabled" },
          "404": { description: "User not found" },
        },
      },
    },

    // ==================== Better Auth ====================
    "/api/auth/sign-up/email": {
      post: {
        tags: ["Auth"],
        summary: "Sign up with email and password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User created and session returned" },
          "400": { description: "Validation error or email already in use" },
        },
      },
    },
    "/api/auth/sign-in/email": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with email and password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Session created, cookie set" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/sign-out": {
      post: {
        tags: ["Auth"],
        summary: "Sign out",
        description: "Invalidate the current session and clear the session cookie.",
        responses: {
          "200": { description: "Signed out successfully" },
        },
      },
    },
    "/api/auth/get-session": {
      get: {
        tags: ["Auth"],
        summary: "Get current session",
        description: "Returns the current user and session if authenticated.",
        responses: {
          "200": {
            description: "Session data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    session: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        token: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/auth/forget-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  redirectTo: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset email sent (if email exists)" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with token",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string" },
                  newPassword: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset successfully" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change password",
        description: "Change the current user's password (requires current password).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password changed" },
          "400": { description: "Current password incorrect" },
        },
      },
    },
    "/api/auth/update-user": {
      post: {
        tags: ["Auth"],
        summary: "Update user profile via auth",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  image: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User updated" },
        },
      },
    },
    "/api/auth/delete-user": {
      post: {
        tags: ["Auth"],
        summary: "Delete user account via auth",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User deleted" },
        },
      },
    },
    "/api/auth/list-sessions": {
      get: {
        tags: ["Auth"],
        summary: "List active sessions",
        responses: {
          "200": {
            description: "List of active sessions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      token: { type: "string" },
                      expiresAt: { type: "string", format: "date-time" },
                      ipAddress: { type: "string" },
                      userAgent: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/revoke-session": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Session revoked" },
        },
      },
    },
    "/api/auth/revoke-sessions": {
      post: {
        tags: ["Auth"],
        summary: "Revoke all other sessions",
        responses: {
          "200": { description: "All other sessions revoked" },
        },
      },
    },

    // ==================== Two-Factor Auth ====================
    "/api/auth/two-factor/enable": {
      post: {
        tags: ["Two-Factor"],
        summary: "Enable two-factor authentication",
        description: "Generates a TOTP secret and returns a QR code URI.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "TOTP secret and backup codes",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totpURI: { type: "string" },
                    backupCodes: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/two-factor/disable": {
      post: {
        tags: ["Two-Factor"],
        summary: "Disable two-factor authentication",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Two-factor disabled" },
        },
      },
    },
    "/api/auth/two-factor/verify-totp": {
      post: {
        tags: ["Two-Factor"],
        summary: "Verify TOTP code",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: {
                  code: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "TOTP verified, session created" },
          "401": { description: "Invalid code" },
        },
      },
    },
    "/api/auth/two-factor/send-otp": {
      post: {
        tags: ["Two-Factor"],
        summary: "Send OTP via email",
        security: [],
        responses: {
          "200": { description: "OTP sent to registered email" },
        },
      },
    },
    "/api/auth/two-factor/verify-otp": {
      post: {
        tags: ["Two-Factor"],
        summary: "Verify OTP code",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: {
                  code: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OTP verified, session created" },
          "401": { description: "Invalid code" },
        },
      },
    },
    "/api/auth/two-factor/verify-backup-code": {
      post: {
        tags: ["Two-Factor"],
        summary: "Verify backup code",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: {
                  code: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Backup code verified, session created" },
          "401": { description: "Invalid code" },
        },
      },
    },
    "/api/auth/two-factor/generate-backup-codes": {
      post: {
        tags: ["Two-Factor"],
        summary: "Generate new backup codes",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "New backup codes generated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    backupCodes: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==================== Passkeys ====================
    "/api/auth/passkey/register-options": {
      get: {
        tags: ["Passkeys"],
        summary: "Get passkey registration options",
        responses: {
          "200": {
            description: "WebAuthn registration options (PublicKeyCredentialCreationOptions)",
          },
        },
      },
    },
    "/api/auth/passkey/register": {
      post: {
        tags: ["Passkeys"],
        summary: "Register a passkey",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "WebAuthn registration response (AuthenticatorAttestationResponse)",
              },
            },
          },
        },
        responses: {
          "200": { description: "Passkey registered" },
        },
      },
    },
    "/api/auth/passkey/authenticate-options": {
      get: {
        tags: ["Passkeys"],
        summary: "Get passkey authentication options",
        security: [],
        responses: {
          "200": {
            description: "WebAuthn authentication options (PublicKeyCredentialRequestOptions)",
          },
        },
      },
    },
    "/api/auth/passkey/authenticate": {
      post: {
        tags: ["Passkeys"],
        summary: "Authenticate with a passkey",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "WebAuthn authentication response (AuthenticatorAssertionResponse)",
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated, session created" },
          "401": { description: "Authentication failed" },
        },
      },
    },
    "/api/auth/passkey/list-passkeys": {
      get: {
        tags: ["Passkeys"],
        summary: "List registered passkeys",
        responses: {
          "200": {
            description: "List of passkeys",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/passkey/delete-passkey": {
      post: {
        tags: ["Passkeys"],
        summary: "Delete a passkey",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Passkey deleted" },
        },
      },
    },

    // ==================== OAuth ====================
    "/api/auth/sign-in/social": {
      post: {
        tags: ["OAuth"],
        summary: "Sign in with social provider",
        description: "Initiates OAuth flow. Redirects to provider for authentication.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["provider"],
                properties: {
                  provider: { type: "string", enum: ["google", "github", "discord"] },
                  callbackURL: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Redirect URL for OAuth flow" },
        },
      },
    },
    "/api/auth/callback/{provider}": {
      get: {
        tags: ["OAuth"],
        summary: "OAuth callback",
        description: "Handles the callback from OAuth providers after authentication.",
        security: [],
        parameters: [
          {
            name: "provider",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["google", "github", "discord"] },
          },
        ],
        responses: {
          "302": { description: "Redirects to frontend with session" },
        },
      },
    },

    // ==================== Account ====================
    "/api/account/me": {
      get: {
        tags: ["Account"],
        summary: "Get current user profile",
        responses: {
          "200": {
            description: "User profile with server count",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
          },
          "401": { description: "Not authenticated" },
        },
      },
      patch: {
        tags: ["Account"],
        summary: "Update current user profile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 100 },
                  image: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated user" },
        },
      },
      delete: {
        tags: ["Account"],
        summary: "Delete current user account",
        description: "Only works if user has no active servers.",
        responses: {
          "200": { description: "Account deleted" },
          "400": { description: "Cannot delete account with active servers" },
        },
      },
    },

    // ==================== Admin Users ====================
    "/api/account/users": {
      get: {
        tags: ["Admin Users"],
        summary: "List all users (admin)",
        responses: {
          "200": {
            description: "List of users",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/User" } },
              },
            },
          },
          "403": { description: "Not an admin" },
        },
      },
      post: {
        tags: ["Admin Users"],
        summary: "Create user (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 100 },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  role: { type: "string", enum: ["user", "admin"], default: "user" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "User created" },
          "400": { description: "Email already exists" },
        },
      },
    },
    "/api/account/users/{id}": {
      get: {
        tags: ["Admin Users"],
        summary: "Get single user (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "User with servers" },
          "404": { description: "User not found" },
        },
      },
      patch: {
        tags: ["Admin Users"],
        summary: "Update user (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  role: { type: "string", enum: ["user", "admin"] },
                  image: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User updated" },
          "404": { description: "User not found" },
        },
      },
      delete: {
        tags: ["Admin Users"],
        summary: "Delete user (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "User deleted" },
          "400": { description: "Cannot delete own account or user has servers" },
        },
      },
    },

    // ==================== Admin Email ====================
    "/api/account/admin/email/status": {
      get: {
        tags: ["Admin Email"],
        summary: "Get email configuration status (admin)",
        responses: {
          "200": { description: "Email config status" },
        },
      },
    },
    "/api/account/admin/email/test": {
      post: {
        tags: ["Admin Email"],
        summary: "Send test email (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Test email sent" },
          "500": { description: "Failed to send" },
        },
      },
    },

    // ==================== Locations ====================
    "/api/locations": {
      get: {
        tags: ["Locations"],
        summary: "List all locations",
        security: [],
        responses: {
          "200": {
            description: "List of locations with node counts",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Location" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Locations"],
        summary: "Create location (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 100 },
                  description: { type: "string" },
                  country: { type: "string" },
                  city: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Location created" },
        },
      },
    },
    "/api/locations/{id}": {
      get: {
        tags: ["Locations"],
        summary: "Get single location",
        security: [],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Location with nodes" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        tags: ["Locations"],
        summary: "Update location (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  country: { type: "string" },
                  city: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Location updated" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Locations"],
        summary: "Delete location (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Location deleted" },
          "400": { description: "Has associated nodes" },
        },
      },
    },

    // ==================== Nodes ====================
    "/api/nodes": {
      get: {
        tags: ["Nodes"],
        summary: "List all nodes (admin)",
        responses: {
          "200": {
            description: "List of nodes",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Node" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Nodes"],
        summary: "Create node (admin)",
        description: "Creates a new node and returns the authentication token (shown only once).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "displayName",
                  "host",
                  "port",
                  "memoryLimit",
                  "diskLimit",
                  "cpuLimit",
                  "locationId",
                ],
                properties: {
                  displayName: { type: "string", minLength: 1, maxLength: 100 },
                  host: { type: "string" },
                  port: { type: "integer", minimum: 1, maximum: 65535 },
                  protocol: {
                    type: "string",
                    enum: ["HTTP", "HTTPS", "HTTPS_PROXY"],
                    default: "HTTP",
                  },
                  sftpPort: { type: "integer", default: 2022 },
                  memoryLimit: { type: "integer", description: "bytes" },
                  diskLimit: { type: "integer", description: "bytes" },
                  cpuLimit: { type: "number", description: "cores" },
                  uploadLimit: { type: "integer", default: 104857600 },
                  locationId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Node created with token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    node: { $ref: "#/components/schemas/Node" },
                    token_id: { type: "string" },
                    token: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/nodes/{id}": {
      get: {
        tags: ["Nodes"],
        summary: "Get single node (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Node with allocations and servers" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        tags: ["Nodes"],
        summary: "Update node (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  displayName: { type: "string" },
                  host: { type: "string" },
                  port: { type: "integer" },
                  protocol: { type: "string", enum: ["HTTP", "HTTPS", "HTTPS_PROXY"] },
                  sftpPort: { type: "integer" },
                  memoryLimit: { type: "integer" },
                  diskLimit: { type: "integer" },
                  cpuLimit: { type: "number" },
                  uploadLimit: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Node updated" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Nodes"],
        summary: "Delete node (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Node deleted" },
          "400": { description: "Has associated servers" },
        },
      },
    },
    "/api/nodes/{id}/regenerate-token": {
      post: {
        tags: ["Nodes"],
        summary: "Regenerate node token (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "New token generated (shown only once)" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/nodes/{id}/stats": {
      get: {
        tags: ["Nodes"],
        summary: "Get node stats from daemon (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Node statistics" },
          "400": { description: "Node is offline" },
        },
      },
    },

    // ==================== Node Allocations ====================
    "/api/nodes/{id}/allocations": {
      post: {
        tags: ["Node Allocations"],
        summary: "Add single allocation (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ip", "port"],
                properties: {
                  ip: { type: "string", format: "ipv4" },
                  port: { type: "integer", minimum: 1, maximum: 65535 },
                  alias: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Allocation created" },
          "409": { description: "Already exists" },
        },
      },
    },
    "/api/nodes/{id}/allocations/range": {
      post: {
        tags: ["Node Allocations"],
        summary: "Add allocation range (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ip", "startPort", "endPort"],
                properties: {
                  ip: { type: "string", format: "ipv4" },
                  startPort: { type: "integer", minimum: 1, maximum: 65535 },
                  endPort: { type: "integer", minimum: 1, maximum: 65535 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Allocations created" },
        },
      },
    },
    "/api/nodes/{id}/allocations/{allocationId}": {
      delete: {
        tags: ["Node Allocations"],
        summary: "Delete allocation (admin)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "allocationId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Allocation deleted" },
          "400": { description: "Cannot delete assigned allocation" },
        },
      },
    },

    // ==================== Node Daemon ====================
    "/api/nodes/handshake": {
      post: {
        tags: ["Node Daemon"],
        summary: "Daemon handshake",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Node configuration and server list" },
        },
      },
    },
    "/api/nodes/heartbeat": {
      post: {
        tags: ["Node Daemon"],
        summary: "Daemon heartbeat",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  latency: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Heartbeat acknowledged" },
        },
      },
    },
    "/api/nodes/servers/{serverId}/status": {
      post: {
        tags: ["Node Daemon"],
        summary: "Report server status (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string" },
                  containerId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Status updated" },
        },
      },
    },

    // ==================== Blueprints ====================
    "/api/blueprints": {
      get: {
        tags: ["Blueprints"],
        summary: "List blueprints",
        description: "Returns public blueprints for users, all blueprints for admins.",
        responses: {
          "200": {
            description: "List of blueprints",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Blueprint" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Blueprints"],
        summary: "Create blueprint (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  author: { type: "string" },
                  dockerImages: { type: "object", additionalProperties: { type: "string" } },
                  startup: { type: "string" },
                  config: { type: "object" },
                  scripts: { type: "object" },
                  variables: { type: "array", items: { type: "object" } },
                  features: { type: "array", items: { type: "string" } },
                  fileDenylist: { type: "array", items: { type: "string" } },
                  dockerConfig: { type: "object" },
                  isPublic: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Blueprint created" },
        },
      },
    },
    "/api/blueprints/{id}": {
      get: {
        tags: ["Blueprints"],
        summary: "Get single blueprint",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Blueprint details" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        tags: ["Blueprints"],
        summary: "Update blueprint (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Blueprint updated" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Blueprints"],
        summary: "Delete blueprint (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Blueprint deleted" },
          "400": { description: "In use by servers" },
        },
      },
    },
    "/api/blueprints/import/egg": {
      post: {
        tags: ["Blueprints"],
        summary: "Import Pterodactyl egg (admin)",
        description: "Import a Pterodactyl egg JSON as a new blueprint.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Pterodactyl egg JSON format",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  author: { type: "string" },
                  description: { type: "string" },
                  docker_images: { type: "object" },
                  startup: { type: "string" },
                  config: { type: "object" },
                  scripts: { type: "object" },
                  variables: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Egg imported as blueprint" },
          "400": { description: "Invalid egg format" },
        },
      },
    },
    "/api/blueprints/{id}/export/egg": {
      get: {
        tags: ["Blueprints"],
        summary: "Export as Pterodactyl egg (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Pterodactyl egg JSON" },
          "404": { description: "Not found" },
        },
      },
    },

    // ==================== Servers ====================
    "/api/servers": {
      get: {
        tags: ["Servers"],
        summary: "List servers",
        description: "Users see their own servers, admins see all.",
        responses: {
          "200": {
            description: "List of servers",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Server" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Servers"],
        summary: "Create server (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "name",
                  "nodeId",
                  "blueprintId",
                  "memory",
                  "disk",
                  "cpu",
                  "allocationIds",
                ],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  nodeId: { type: "string" },
                  blueprintId: { type: "string" },
                  ownerId: { type: "string" },
                  memory: { type: "integer", description: "MiB" },
                  disk: { type: "integer", description: "MiB" },
                  cpu: { type: "number", description: "percentage (100 = 1 core)" },
                  cpuPinning: { type: "string" },
                  swap: { type: "integer", default: -1 },
                  oomKillDisable: { type: "boolean", default: false },
                  backupLimit: { type: "integer", default: 3 },
                  allocationLimit: { type: "integer", default: 1 },
                  allocationIds: { type: "array", items: { type: "string" }, minItems: 1 },
                  variables: { type: "object", additionalProperties: { type: "string" } },
                  dockerImage: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Server created" },
          "400": { description: "Validation or resource error" },
        },
      },
    },
    "/api/servers/permissions": {
      get: {
        tags: ["Servers"],
        summary: "Get permission definitions",
        security: [],
        responses: {
          "200": { description: "Permission categories and definitions" },
        },
      },
    },
    "/api/servers/{serverId}": {
      get: {
        tags: ["Servers"],
        summary: "Get single server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Server with node, blueprint, owner, allocations" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        tags: ["Servers"],
        summary: "Update server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  memory: { type: "integer", description: "Admin only" },
                  disk: { type: "integer", description: "Admin only" },
                  cpu: { type: "number", description: "Admin only" },
                  status: { type: "string", description: "Admin only" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Server updated" },
        },
      },
      delete: {
        tags: ["Servers"],
        summary: "Delete server (admin)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Server deleted" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/servers/{serverId}/start": {
      post: {
        tags: ["Servers"],
        summary: "Start server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Server starting" },
          "400": { description: "Node offline or server suspended" },
        },
      },
    },
    "/api/servers/{serverId}/stop": {
      post: {
        tags: ["Servers"],
        summary: "Stop server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server stopping" } },
      },
    },
    "/api/servers/{serverId}/restart": {
      post: {
        tags: ["Servers"],
        summary: "Restart server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server restarting" } },
      },
    },
    "/api/servers/{serverId}/kill": {
      post: {
        tags: ["Servers"],
        summary: "Kill server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server killed" } },
      },
    },
    "/api/servers/{serverId}/sync": {
      post: {
        tags: ["Servers"],
        summary: "Sync server with daemon (admin)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server synced" } },
      },
    },
    "/api/servers/{serverId}/status": {
      patch: {
        tags: ["Servers"],
        summary: "Update server status (admin)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: [
                      "INSTALLING",
                      "STARTING",
                      "RUNNING",
                      "STOPPING",
                      "STOPPED",
                      "SUSPENDED",
                      "ERROR",
                    ],
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Status updated" } },
      },
    },
    "/api/servers/{serverId}/reinstall": {
      post: {
        tags: ["Servers"],
        summary: "Reinstall server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Reinstalling" } },
      },
    },
    "/api/servers/{serverId}/change-blueprint": {
      post: {
        tags: ["Servers"],
        summary: "Change server blueprint",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["blueprintId"],
                properties: {
                  blueprintId: { type: "string" },
                  dockerImage: { type: "string" },
                  variables: { type: "object" },
                  reinstall: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Blueprint changed" } },
      },
    },
    "/api/servers/{serverId}/stats": {
      get: {
        tags: ["Servers"],
        summary: "Get server stats",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server state info" } },
      },
    },
    "/api/servers/{serverId}/logs": {
      get: {
        tags: ["Servers"],
        summary: "Get server logs",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Console output" } },
      },
    },
    "/api/servers/{serverId}/console": {
      get: {
        tags: ["Servers"],
        summary: "Get WebSocket console info",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "WebSocket URL and token" } },
      },
    },
    "/api/servers/{serverId}/command": {
      post: {
        tags: ["Servers"],
        summary: "Send console command",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["command"],
                properties: { command: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Command sent" } },
      },
    },

    // ==================== Server Startup ====================
    "/api/servers/{serverId}/startup": {
      get: {
        tags: ["Server Startup"],
        summary: "Get startup configuration",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Variables, docker images, startup command" } },
      },
      patch: {
        tags: ["Server Startup"],
        summary: "Update startup configuration",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  variables: { type: "object", additionalProperties: { type: "string" } },
                  dockerImage: { type: "string" },
                  customStartupCommands: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Startup updated" } },
      },
    },

    // ==================== Server Files ====================
    "/api/servers/{serverId}/files": {
      get: {
        tags: ["Server Files"],
        summary: "List files",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "path", in: "query", schema: { type: "string", default: "/" } },
        ],
        responses: {
          "200": {
            description: "File listing",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    files: { type: "array", items: { $ref: "#/components/schemas/FileEntry" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/servers/{serverId}/files/read": {
      get: {
        tags: ["Server Files"],
        summary: "Read file contents",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "path", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "File content" } },
      },
    },
    "/api/servers/{serverId}/files/write": {
      post: {
        tags: ["Server Files"],
        summary: "Write file",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path", "content"],
                properties: { path: { type: "string" }, content: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "File written" } },
      },
    },
    "/api/servers/{serverId}/files/upload": {
      post: {
        tags: ["Server Files"],
        summary: "Upload files (multipart)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  directory: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Files uploaded" } },
      },
    },
    "/api/servers/{serverId}/files/create": {
      post: {
        tags: ["Server Files"],
        summary: "Create file or directory",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path"],
                properties: {
                  path: { type: "string" },
                  type: { type: "string", enum: ["file", "directory"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Created" } },
      },
    },
    "/api/servers/{serverId}/files/delete": {
      delete: {
        tags: ["Server Files"],
        summary: "Delete file or directory",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "path", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Deleted" } },
      },
    },
    "/api/servers/{serverId}/files/rename": {
      post: {
        tags: ["Server Files"],
        summary: "Rename file or directory",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["from", "to"],
                properties: { from: { type: "string" }, to: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Renamed" } },
      },
    },
    "/api/servers/{serverId}/files/chmod": {
      post: {
        tags: ["Server Files"],
        summary: "Change file permissions",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path", "mode"],
                properties: {
                  path: { type: "string" },
                  mode: { type: "string", description: "Octal mode e.g. 755" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Permissions changed" } },
      },
    },
    "/api/servers/{serverId}/files/archive": {
      post: {
        tags: ["Server Files"],
        summary: "Create archive (compress)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  files: { type: "array", items: { type: "string" } },
                  root: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Archive created" } },
      },
    },
    "/api/servers/{serverId}/files/extract": {
      post: {
        tags: ["Server Files"],
        summary: "Extract archive (decompress)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { file: { type: "string" }, root: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Archive extracted" } },
      },
    },
    "/api/servers/{serverId}/files/download-token": {
      post: {
        tags: ["Server Files"],
        summary: "Generate file download token",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path"],
                properties: { path: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Download token and URL" } },
      },
    },
    "/api/servers/{serverId}/files/download": {
      get: {
        tags: ["Server Files"],
        summary: "Download file (signed token)",
        security: [],
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "token", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "File content (binary)" } },
      },
    },
    "/api/servers/{serverId}/files/disk-usage": {
      get: {
        tags: ["Server Files"],
        summary: "Get disk usage",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Disk usage info" } },
      },
    },

    // ==================== Server Backups ====================
    "/api/servers/{serverId}/backups": {
      get: {
        tags: ["Server Backups"],
        summary: "List backups",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "List of backups",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Backup" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Server Backups"],
        summary: "Create backup",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  ignore: { type: "array", items: { type: "string" } },
                  locked: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Backup created" } },
      },
    },
    "/api/servers/{serverId}/backups/restore": {
      post: {
        tags: ["Server Backups"],
        summary: "Restore backup",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Backup restored" } },
      },
    },
    "/api/servers/{serverId}/backups/download-token": {
      post: {
        tags: ["Server Backups"],
        summary: "Generate backup download token",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "Download token and URL" } },
      },
    },
    "/api/servers/{serverId}/backups/download": {
      get: {
        tags: ["Server Backups"],
        summary: "Download backup (signed token)",
        security: [],
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "token", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Backup file (binary)" } },
      },
    },
    "/api/servers/{serverId}/backups/delete": {
      delete: {
        tags: ["Server Backups"],
        summary: "Delete backup",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Backup deleted" },
          "403": { description: "Backup is locked" },
        },
      },
    },
    "/api/servers/{serverId}/backups/lock": {
      patch: {
        tags: ["Server Backups"],
        summary: "Lock/unlock backup",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "query", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["locked"],
                properties: { locked: { type: "boolean" } },
              },
            },
          },
        },
        responses: { "200": { description: "Lock state updated" } },
      },
    },

    // ==================== Schedules ====================
    "/api/servers/{serverId}/schedules": {
      get: {
        tags: ["Server Schedules"],
        summary: "List schedules",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "List of schedules",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Schedule" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Server Schedules"],
        summary: "Create schedule",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "cronExpression", "tasks"],
                properties: {
                  name: { type: "string" },
                  cronExpression: { type: "string" },
                  isActive: { type: "boolean", default: true },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["action"],
                      properties: {
                        action: {
                          type: "string",
                          enum: ["power_start", "power_stop", "power_restart", "backup", "command"],
                        },
                        payload: { type: "string" },
                        timeOffset: { type: "integer" },
                        sequence: { type: "integer" },
                        triggerMode: { type: "string", enum: ["TIME_DELAY", "ON_COMPLETION"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Schedule created" } },
      },
    },
    "/api/servers/{serverId}/schedules/{scheduleId}": {
      get: {
        tags: ["Server Schedules"],
        summary: "Get schedule",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "scheduleId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Schedule details" } },
      },
      patch: {
        tags: ["Server Schedules"],
        summary: "Update schedule",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "scheduleId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Schedule updated" } },
      },
      delete: {
        tags: ["Server Schedules"],
        summary: "Delete schedule",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "scheduleId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Schedule deleted" } },
      },
    },
    "/api/servers/{serverId}/schedules/{scheduleId}/run": {
      post: {
        tags: ["Server Schedules"],
        summary: "Run schedule now",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "scheduleId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Schedule triggered" } },
      },
    },

    // ==================== Server Allocations ====================
    "/api/servers/{serverId}/allocations": {
      get: {
        tags: ["Server Allocations"],
        summary: "List server allocations",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "List of allocations" } },
      },
      post: {
        tags: ["Server Allocations"],
        summary: "Add allocation to server",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["allocationId"],
                properties: { allocationId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Allocation added" } },
      },
    },
    "/api/servers/{serverId}/allocations/available": {
      get: {
        tags: ["Server Allocations"],
        summary: "List available allocations on node (admin)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Available allocations" } },
      },
    },
    "/api/servers/{serverId}/allocations/{allocationId}": {
      delete: {
        tags: ["Server Allocations"],
        summary: "Remove allocation from server",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "allocationId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Allocation removed" } },
      },
    },
    "/api/servers/{serverId}/allocations/{allocationId}/primary": {
      post: {
        tags: ["Server Allocations"],
        summary: "Set primary allocation",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "allocationId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Primary allocation set" } },
      },
    },

    // ==================== Activity ====================
    "/api/servers/{serverId}/activity": {
      get: {
        tags: ["Server Activity"],
        summary: "Get activity logs",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "event", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Activity logs with pagination" } },
      },
    },

    // ==================== Server Splitting ====================
    "/api/servers/{serverId}/split": {
      post: {
        tags: ["Server Splitting"],
        summary: "Split server into child",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "memoryPercent", "diskPercent", "cpuPercent"],
                properties: {
                  name: { type: "string" },
                  memoryPercent: { type: "number", minimum: 10, maximum: 90 },
                  diskPercent: { type: "number", minimum: 10, maximum: 90 },
                  cpuPercent: { type: "number", minimum: 10, maximum: 90 },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Server split" } },
      },
    },
    "/api/servers/{serverId}/children": {
      get: {
        tags: ["Server Splitting"],
        summary: "List child servers",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Child server list" } },
      },
    },

    // ==================== Server Transfer ====================
    "/api/servers/{serverId}/transfer": {
      post: {
        tags: ["Server Transfer"],
        summary: "Initiate server transfer",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targetNodeId"],
                properties: { targetNodeId: { type: "string", format: "uuid" } },
              },
            },
          },
        },
        responses: { "200": { description: "Transfer started" } },
      },
      get: {
        tags: ["Server Transfer"],
        summary: "Get active transfer status",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Transfer status" } },
      },
      delete: {
        tags: ["Server Transfer"],
        summary: "Cancel transfer",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Transfer cancelled" } },
      },
    },
    "/api/servers/{serverId}/transfer/history": {
      get: {
        tags: ["Server Transfer"],
        summary: "Get transfer history",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Transfer history" } },
      },
    },

    // ==================== Server Settings ====================
    "/api/servers/{serverId}/settings": {
      get: {
        tags: ["Server Settings"],
        summary: "Get server settings",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server settings (MOTD etc.)" } },
      },
      patch: {
        tags: ["Server Settings"],
        summary: "Update server settings (admin)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { motd: { type: "string", maxLength: 500 } } },
            },
          },
        },
        responses: { "200": { description: "Settings updated" } },
      },
    },

    // ==================== Firewall ====================
    "/api/servers/{serverId}/firewall": {
      get: {
        tags: ["Firewall"],
        summary: "List firewall rules",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "List of firewall rules",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/FirewallRule" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Firewall"],
        summary: "Create firewall rule (admin)",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "direction", "action", "port", "protocol"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  direction: { type: "string", enum: ["INBOUND", "OUTBOUND"] },
                  action: { type: "string", enum: ["ALLOW", "DENY"] },
                  port: { type: "integer" },
                  protocol: { type: "string", enum: ["tcp", "udp", "both"] },
                  sourceIp: { type: "string" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Rule created" } },
      },
    },
    "/api/servers/{serverId}/firewall/{ruleId}": {
      patch: {
        tags: ["Firewall"],
        summary: "Update firewall rule (admin)",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "ruleId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Rule updated" } },
      },
      delete: {
        tags: ["Firewall"],
        summary: "Delete firewall rule (admin)",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "ruleId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Rule deleted" } },
      },
    },

    // ==================== Subdomains ====================
    "/api/servers/{serverId}/subdomain": {
      get: {
        tags: ["Subdomains"],
        summary: "Get server subdomain",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Subdomain info" } },
      },
      post: {
        tags: ["Subdomains"],
        summary: "Claim subdomain",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subdomain"],
                properties: { subdomain: { type: "string", minLength: 3, maxLength: 32 } },
              },
            },
          },
        },
        responses: { "201": { description: "Subdomain claimed" } },
      },
      delete: {
        tags: ["Subdomains"],
        summary: "Release subdomain",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Subdomain released" } },
      },
    },

    // ==================== Custom Domains ====================
    "/api/servers/{serverId}/domains": {
      get: {
        tags: ["Custom Domains"],
        summary: "List custom domains",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Custom domains" } },
      },
      post: {
        tags: ["Custom Domains"],
        summary: "Add custom domain",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["domain"],
                properties: { domain: { type: "string", minLength: 4, maxLength: 253 } },
              },
            },
          },
        },
        responses: { "201": { description: "Domain added with verification instructions" } },
      },
    },
    "/api/servers/{serverId}/domains/{domainId}/verify": {
      post: {
        tags: ["Custom Domains"],
        summary: "Verify domain ownership",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "domainId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Verification result" } },
      },
    },
    "/api/servers/{serverId}/domains/{domainId}": {
      delete: {
        tags: ["Custom Domains"],
        summary: "Remove custom domain",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "domainId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Domain removed" } },
      },
    },

    // ==================== Members ====================
    "/api/servers/{serverId}/members": {
      get: {
        tags: ["Members"],
        summary: "List server members",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "List of members" } },
      },
    },
    "/api/servers/{serverId}/members/{memberId}": {
      get: {
        tags: ["Members"],
        summary: "Get member details",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Member details" } },
      },
      patch: {
        tags: ["Members"],
        summary: "Update member permissions",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["permissions"],
                properties: { permissions: { type: "array", items: { type: "string" } } },
              },
            },
          },
        },
        responses: { "200": { description: "Permissions updated" } },
      },
      delete: {
        tags: ["Members"],
        summary: "Remove member",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Member removed" } },
      },
    },

    // ==================== Invitations ====================
    "/api/servers/{serverId}/invitations": {
      get: {
        tags: ["Invitations"],
        summary: "List pending invitations",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "List of invitations" } },
      },
      post: {
        tags: ["Invitations"],
        summary: "Send invitation",
        parameters: [{ name: "serverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "permissions"],
                properties: {
                  email: { type: "string", format: "email" },
                  permissions: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Invitation sent" } },
      },
    },
    "/api/servers/{serverId}/invitations/{invitationId}": {
      delete: {
        tags: ["Invitations"],
        summary: "Cancel invitation",
        parameters: [
          { name: "serverId", in: "path", required: true, schema: { type: "string" } },
          { name: "invitationId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Invitation cancelled" } },
      },
    },
    "/api/servers/invitation/{token}": {
      get: {
        tags: ["Invitations"],
        summary: "Get invitation by token",
        security: [],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Invitation details" } },
      },
    },
    "/api/servers/invitation/{token}/accept": {
      post: {
        tags: ["Invitations"],
        summary: "Accept invitation",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Invitation accepted" } },
      },
    },
    "/api/servers/invitation/{token}/decline": {
      post: {
        tags: ["Invitations"],
        summary: "Decline invitation",
        security: [],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Invitation declined" } },
      },
    },
    "/api/servers/my-memberships": {
      get: {
        tags: ["Members"],
        summary: "Get user's server memberships",
        responses: { "200": { description: "List of memberships" } },
      },
    },
    "/api/servers/my-invitations": {
      get: {
        tags: ["Invitations"],
        summary: "Get user's pending invitations",
        responses: { "200": { description: "List of pending invitations" } },
      },
    },

    // ==================== Webhooks ====================
    "/api/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhooks",
        responses: {
          "200": {
            description: "List of user's webhooks",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Webhook" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create webhook",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", format: "uri" },
                  events: { type: "array", items: { type: "string" } },
                  serverId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Webhook created" } },
      },
    },
    "/api/webhooks/events": {
      get: {
        tags: ["Webhooks"],
        summary: "List available webhook events",
        responses: { "200": { description: "Events categorized" } },
      },
    },
    "/api/webhooks/{id}": {
      get: {
        tags: ["Webhooks"],
        summary: "Get webhook with recent deliveries",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Webhook details" } },
      },
      patch: {
        tags: ["Webhooks"],
        summary: "Update webhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                  events: { type: "array", items: { type: "string" } },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Webhook updated" } },
      },
      delete: {
        tags: ["Webhooks"],
        summary: "Delete webhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Webhook deleted" } },
      },
    },
    "/api/webhooks/{id}/deliveries": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook deliveries",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Paginated deliveries" } },
      },
    },
    "/api/webhooks/{id}/deliveries/{deliveryId}": {
      get: {
        tags: ["Webhooks"],
        summary: "Get delivery details",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "deliveryId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Delivery details" } },
      },
    },
    "/api/webhooks/{id}/deliveries/{deliveryId}/retry": {
      post: {
        tags: ["Webhooks"],
        summary: "Retry failed delivery",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "deliveryId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Retry result" } },
      },
    },
    "/api/webhooks/{id}/test": {
      post: {
        tags: ["Webhooks"],
        summary: "Test webhook URL",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Test result" } },
      },
    },

    // ==================== Admin Settings ====================
    "/api/admin/settings": {
      get: {
        tags: ["Admin Settings"],
        summary: "Get all settings overview (admin)",
        responses: { "200": { description: "Settings overview" } },
      },
    },
    "/api/admin/settings/cloudflare": {
      get: {
        tags: ["Admin Settings"],
        summary: "Get Cloudflare settings (admin)",
        responses: { "200": { description: "Cloudflare settings (token masked)" } },
      },
      patch: {
        tags: ["Admin Settings"],
        summary: "Update Cloudflare settings (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  apiToken: { type: "string" },
                  zoneId: { type: "string" },
                  domain: { type: "string" },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Settings updated" } },
      },
    },
    "/api/admin/settings/cloudflare/test": {
      post: {
        tags: ["Admin Settings"],
        summary: "Test Cloudflare connection (admin)",
        responses: { "200": { description: "Connection test result" } },
      },
    },
    "/api/admin/settings/subdomains": {
      get: {
        tags: ["Admin Settings"],
        summary: "Get subdomain settings (admin)",
        responses: { "200": { description: "Subdomain settings" } },
      },
      patch: {
        tags: ["Admin Settings"],
        summary: "Update subdomain settings (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  baseDomain: { type: "string" },
                  autoProvision: { type: "boolean" },
                  dnsProvider: { type: "string", enum: ["cloudflare", "manual"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Settings updated" } },
      },
    },
    "/api/admin/settings/email": {
      get: {
        tags: ["Admin Settings"],
        summary: "Get email settings (admin)",
        responses: { "200": { description: "Email settings (secrets masked)" } },
      },
      patch: {
        tags: ["Admin Settings"],
        summary: "Update email settings (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  provider: { type: "string", enum: ["smtp", "resend", "sendgrid", "mailgun"] },
                  fromEmail: { type: "string" },
                  fromName: { type: "string" },
                  smtp: { type: "object" },
                  apiKey: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Settings updated" } },
      },
    },
    "/api/admin/settings/email/test": {
      post: {
        tags: ["Admin Settings"],
        summary: "Test email config (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["testEmail"],
                properties: { testEmail: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: { "200": { description: "Test result" } },
      },
    },
    "/api/admin/settings/branding": {
      get: {
        tags: ["Admin Settings"],
        summary: "Get branding settings (admin)",
        responses: { "200": { description: "Branding settings" } },
      },
      patch: {
        tags: ["Admin Settings"],
        summary: "Update branding settings (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  appName: { type: "string" },
                  logoUrl: { type: "string" },
                  faviconUrl: { type: "string" },
                  primaryColor: { type: "string" },
                  supportEmail: { type: "string" },
                  supportUrl: { type: "string" },
                  termsUrl: { type: "string" },
                  privacyUrl: { type: "string" },
                  footerText: { type: "string" },
                  customCss: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Settings updated" } },
      },
    },
    "/api/admin/settings/branding/public": {
      get: {
        tags: ["Admin Settings"],
        summary: "Get public branding (no auth)",
        security: [],
        responses: { "200": { description: "Public branding info" } },
      },
    },

    // ==================== Analytics ====================
    "/api/analytics/system-metrics": {
      get: {
        tags: ["Analytics"],
        summary: "System-wide metrics (admin)",
        responses: { "200": { description: "System metrics" } },
      },
    },
    "/api/analytics/node-metrics": {
      get: {
        tags: ["Analytics"],
        summary: "Node health metrics (admin)",
        responses: { "200": { description: "Node metrics" } },
      },
    },
    "/api/analytics/server-metrics": {
      get: {
        tags: ["Analytics"],
        summary: "Server resource metrics (admin)",
        parameters: [{ name: "nodeId", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Server metrics" } },
      },
    },
    "/api/analytics/cpu-series": {
      get: {
        tags: ["Analytics"],
        summary: "CPU usage time series (admin)",
        parameters: [
          {
            name: "timeRange",
            in: "query",
            schema: { type: "string", enum: ["24h", "7d", "30d", "90d", "1y"] },
          },
        ],
        responses: { "200": { description: "CPU time series" } },
      },
    },
    "/api/analytics/memory-series": {
      get: {
        tags: ["Analytics"],
        summary: "Memory usage time series (admin)",
        parameters: [
          {
            name: "timeRange",
            in: "query",
            schema: { type: "string", enum: ["24h", "7d", "30d", "90d", "1y"] },
          },
        ],
        responses: { "200": { description: "Memory time series" } },
      },
    },
    "/api/analytics/disk-series": {
      get: {
        tags: ["Analytics"],
        summary: "Disk usage time series (admin)",
        parameters: [
          {
            name: "timeRange",
            in: "query",
            schema: { type: "string", enum: ["24h", "7d", "30d", "90d", "1y"] },
          },
        ],
        responses: { "200": { description: "Disk time series" } },
      },
    },
    "/api/analytics/backup-storage": {
      get: {
        tags: ["Analytics"],
        summary: "Backup storage metrics (admin)",
        responses: { "200": { description: "Backup storage analytics" } },
      },
    },
    "/api/analytics/blueprint-metrics": {
      get: {
        tags: ["Analytics"],
        summary: "Blueprint usage analytics (admin)",
        responses: { "200": { description: "Blueprint metrics" } },
      },
    },
    "/api/analytics/api-metrics": {
      get: {
        tags: ["Analytics"],
        summary: "API usage metrics (admin)",
        responses: { "200": { description: "API metrics" } },
      },
    },
    "/api/analytics/webhook-metrics": {
      get: {
        tags: ["Analytics"],
        summary: "Webhook delivery metrics (admin)",
        responses: { "200": { description: "Webhook metrics" } },
      },
    },
    "/api/analytics/dashboard": {
      get: {
        tags: ["Analytics"],
        summary: "Complete analytics dashboard (admin)",
        parameters: [
          {
            name: "timeRange",
            in: "query",
            schema: { type: "string", enum: ["24h", "7d", "30d", "90d", "1y"] },
          },
        ],
        responses: { "200": { description: "Complete dashboard data" } },
      },
    },
    "/api/analytics/export": {
      get: {
        tags: ["Analytics"],
        summary: "Export analytics data (admin)",
        parameters: [
          { name: "timeRange", in: "query", schema: { type: "string" } },
          { name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } },
        ],
        responses: { "200": { description: "Exported file" } },
      },
    },

    // ==================== Remote (Daemon-facing) ====================
    "/api/remote/servers": {
      get: {
        tags: ["Remote"],
        summary: "List servers for node (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "per_page", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Paginated server configs" } },
      },
    },
    "/api/remote/servers/{uuid}": {
      get: {
        tags: ["Remote"],
        summary: "Get server config (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "uuid", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Server configuration" } },
      },
    },
    "/api/remote/servers/{uuid}/status": {
      post: {
        tags: ["Remote"],
        summary: "Update server status (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "uuid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: [
                      "installing",
                      "starting",
                      "running",
                      "stopping",
                      "stopped",
                      "offline",
                      "error",
                    ],
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Status updated" } },
      },
    },
    "/api/remote/servers/{uuid}/install": {
      get: {
        tags: ["Remote"],
        summary: "Get install script (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "uuid", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Install script and container config" } },
      },
      post: {
        tags: ["Remote"],
        summary: "Report install result (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "uuid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["successful"],
                properties: { successful: { type: "boolean" }, reinstall: { type: "boolean" } },
              },
            },
          },
        },
        responses: { "200": { description: "Install result recorded" } },
      },
    },
    "/api/remote/backups/{uuid}": {
      post: {
        tags: ["Remote"],
        summary: "Update backup status (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "uuid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["successful", "size"],
                properties: {
                  successful: { type: "boolean" },
                  checksum: { type: "string" },
                  size: { type: "number" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Backup status updated" } },
      },
    },
    "/api/remote/backups/{uuid}/restore": {
      post: {
        tags: ["Remote"],
        summary: "Report restore result (daemon)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "uuid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["successful"],
                properties: { successful: { type: "boolean" } },
              },
            },
          },
        },
        responses: { "200": { description: "Restore result recorded" } },
      },
    },
    "/api/remote/sftp/auth": {
      post: {
        tags: ["Remote"],
        summary: "Validate SFTP credentials (daemon)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", description: "Format: server_uuid.user_uuid" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Auth result with permissions" } },
      },
    },
    "/api/remote/activity": {
      post: {
        tags: ["Remote"],
        summary: "Submit activity logs (daemon)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["server", "event", "timestamp"],
                      properties: {
                        server: { type: "string" },
                        event: { type: "string" },
                        metadata: { type: "object" },
                        ip: { type: "string" },
                        timestamp: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Logs stored" } },
      },
    },
    "/api/remote/metrics": {
      post: {
        tags: ["Remote"],
        summary: "Submit node/server metrics (daemon)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["node"],
                properties: {
                  node: {
                    type: "object",
                    properties: {
                      cpu_usage: { type: "number" },
                      memory_usage: { type: "number" },
                      memory_limit: { type: "number" },
                      disk_usage: { type: "number" },
                      disk_limit: { type: "number" },
                      active_containers: { type: "integer" },
                      total_containers: { type: "integer" },
                    },
                  },
                  servers: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Metrics stored" } },
      },
    },
    "/api/remote/maintenance/enter": {
      post: {
        tags: ["Remote"],
        summary: "Enter maintenance mode (daemon)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Servers set to maintenance" } },
      },
    },
    "/api/remote/maintenance/exit": {
      post: {
        tags: ["Remote"],
        summary: "Exit maintenance mode (daemon)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Servers restored" } },
      },
    },

    // ==================== Features ====================
    "/api/features/subdomains": {
      get: {
        tags: ["Features"],
        summary: "Check if subdomains are enabled",
        security: [],
        responses: {
          "200": {
            description: "Subdomain feature status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    baseDomain: { type: "string", nullable: true },
                    dnsProvider: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==================== WebSocket ====================
    "/api/ws/token": {
      get: {
        tags: ["WebSocket"],
        summary: "Get WebSocket auth token",
        responses: {
          "200": {
            description: "Token for WebSocket authentication",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { token: { type: "string" }, userId: { type: "string" } },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/ws": {
      get: {
        tags: ["WebSocket"],
        summary: "WebSocket endpoint",
        description:
          "Connect via WebSocket for real-time server events and console. Authenticate via cookie or send `{type: 'auth', token: '...'}` message.",
        responses: { "101": { description: "WebSocket upgrade" } },
      },
    },
  },
};
