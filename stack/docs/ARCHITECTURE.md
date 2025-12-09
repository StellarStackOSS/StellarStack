# StellarStack Architecture Design Document

> **Version:** 1.0.0
> **Last Updated:** December 2024
> **Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Component Deep Dive](#3-component-deep-dive)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Daemon Registration & Management](#5-daemon-registration--management)
6. [Console Access & Permissions](#6-console-access--permissions)
7. [Real-time Communication](#7-real-time-communication)
8. [Deployment Strategies](#8-deployment-strategies)
9. [Auto-scaling](#9-auto-scaling)
10. [Version Control & Updates](#10-version-control--updates)
11. [Infrastructure Recommendations](#11-infrastructure-recommendations)
12. [Security Considerations](#12-security-considerations)
13. [Database Schema](#13-database-schema)
14. [API Design](#14-api-design)
15. [Failure Modes & Recovery](#15-failure-modes--recovery)

---

## 1. Overview

### 1.1 What is StellarStack?

StellarStack is an **open-source, self-hosted game server management panel** — similar to Pterodactyl, but built with a modern tech stack. It allows hosting providers, communities, and individuals to:

- Deploy the panel on their own infrastructure
- Manage game servers across their own hardware/VPS nodes
- Provide a web interface for their users/customers to manage servers
- Scale from a single machine to dozens of nodes

**StellarStack is NOT a SaaS** — users download and self-host the entire platform on their own servers.

### 1.2 Deployment Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SELF-HOSTED BY OPERATOR                             │
│                    (Hosting Provider / Community / Individual)               │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        CONTROL PLANE                                 │   │
│   │                    (Operator's Server/VPS)                          │   │
│   │                                                                      │   │
│   │    panel.example.com ──▶ Next.js + Hono + PostgreSQL + Redis        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                          (Operator connects their nodes)                     │
│                                     │                                        │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │     Node 1      │   │     Node 2      │   │     Node 3      │          │
│   │  (Dedicated)    │   │   (VPS)         │   │  (Home Server)  │          │
│   │   Rust Daemon   │   │   Rust Daemon   │   │   Rust Daemon   │          │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘          │
│                                                                              │
│   End Users (customers/members) access panel.example.com                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Target Users

| User Type | Use Case |
|-----------|----------|
| **Hosting Providers** | Run a game server hosting business, sell servers to customers |
| **Gaming Communities** | Self-host servers for clan/guild members |
| **Individual Gamers** | Manage personal game servers across multiple machines |
| **Developers** | Test and deploy game servers during development |

### 1.4 Design Goals

- **Self-hosted**: Full control over data and infrastructure
- **Multi-node**: Connect unlimited nodes (dedicated servers, VPS, home machines)
- **User Management**: Admins create users, assign servers, set permissions
- **Real-time**: Live console, metrics, and status updates
- **Secure**: Zero-trust architecture between components
- **Simple Installation**: Docker-based deployment, minimal configuration
- **Extensible**: Blueprint system for adding new game support

### 1.5 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js 15 | Web application |
| API | Hono | REST API + WebSocket proxy |
| Daemon | Rust | Node agent, container management |
| Database | PostgreSQL | Persistent data storage |
| Cache/Pub-Sub | Redis | Real-time events, caching, queues |
| Containers | Docker | Game server isolation |
| Auth | Better Auth | Authentication & sessions |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 CONTROL PLANE                                    │
│                              (Central Infrastructure)                            │
│                                                                                  │
│    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐                 │
│    │   Caddy/     │      │              │      │              │                 │
│    │   Nginx      │─────▶│   Next.js    │      │  PostgreSQL  │                 │
│    │   (Proxy)    │      │  (Frontend)  │      │   (Primary)  │                 │
│    │   :80/:443   │      │    :3000     │      │    :5432     │                 │
│    └──────┬───────┘      └──────────────┘      └──────┬───────┘                 │
│           │                                           │                          │
│           │              ┌──────────────┐             │                          │
│           └─────────────▶│    Hono      │◀────────────┘                          │
│                          │    (API)     │                                        │
│                          │    :4000     │                                        │
│                          └──────┬───────┘                                        │
│                                 │                                                │
│                          ┌──────▼───────┐                                        │
│                          │    Redis     │                                        │
│                          │   Cluster    │                                        │
│                          │    :6379     │                                        │
│                          └──────┬───────┘                                        │
└─────────────────────────────────┼────────────────────────────────────────────────┘
                                  │
                    ══════════════╪══════════════  (Secure Channel - mTLS)
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│     NODE 1      │      │     NODE 2      │      │     NODE 3      │
│   us-west-1     │      │   us-east-1     │      │    eu-west-1    │
│                 │      │                 │      │                 │
│ ┌─────────────┐ │      │ ┌─────────────┐ │      │ ┌─────────────┐ │
│ │ Rust Daemon │ │      │ │ Rust Daemon │ │      │ │ Rust Daemon │ │
│ │   :5000     │ │      │ │   :5000     │ │      │ │   :5000     │ │
│ │ (gRPC/WS)   │ │      │ │ (gRPC/WS)   │ │      │ │ (gRPC/WS)   │ │
│ └──────┬──────┘ │      │ └──────┬──────┘ │      │ └──────┬──────┘ │
│        │        │      │        │        │      │        │        │
│ ┌──────▼──────┐ │      │ ┌──────▼──────┐ │      │ ┌──────▼──────┐ │
│ │   Docker    │ │      │ │   Docker    │ │      │ │   Docker    │ │
│ │ ┌────┬────┐ │ │      │ │ ┌────┬────┐ │ │      │ │ ┌────┬────┐ │ │
│ │ │MC01│MC02│ │ │      │ │ │RS01│RS02│ │ │      │ │ │AK01│VH01│ │ │
│ │ └────┴────┘ │ │      │ │ └────┴────┘ │ │      │ │ └────┴────┘ │ │
│ └─────────────┘ │      │ └─────────────┘ │      │ └─────────────┘ │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### 2.2 Network Topology

```
Internet
    │
    ├─── stellarstack.app ──────────────▶ Control Plane (Caddy)
    │                                          │
    │                                          ├── / ──────────▶ Next.js
    │                                          └── /api/* ─────▶ Hono
    │
    ├─── node-us-west.stellarstack.app ─▶ Node 1 Daemon (Direct WebSocket)
    ├─── node-us-east.stellarstack.app ─▶ Node 2 Daemon (Direct WebSocket)
    └─── node-eu-west.stellarstack.app ─▶ Node 3 Daemon (Direct WebSocket)
```

### 2.3 Data Flow Patterns

#### Pattern A: Dashboard Load
```
User ──▶ Next.js ──▶ Hono API ──▶ PostgreSQL
                         │
                         └──▶ Redis (cached metrics)
```

#### Pattern B: Server Action (Start/Stop/Restart)
```
User ──▶ Next.js ──▶ Hono API ──▶ Redis Pub/Sub ──▶ Daemon ──▶ Docker
                         │                              │
                         └◀──── Event Confirmation ◀────┘
```

#### Pattern C: Console Access (Direct)
```
User ──▶ Next.js ──▶ Hono (auth check) ──▶ Issues signed token
                                                │
User ◀──────────────────────────────────────────┘
  │
  └──▶ Direct WebSocket ──▶ Daemon ──▶ Docker Container PTY
```

#### Pattern D: Real-time Metrics
```
Daemon ──▶ Redis Pub/Sub ──▶ Hono ──▶ SSE/WebSocket ──▶ Next.js ──▶ User
```

### 2.4 Connection Types Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      CONNECTION TYPES SUMMARY                                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┬─────────────────────────────┬─────────────────────────────┐
│    Use Case     │        Connection Path       │           Why?              │
├─────────────────┼─────────────────────────────┼─────────────────────────────┤
│                 │                             │                             │
│  Console        │  Frontend ───WebSocket───▶  │  Low latency, bidirectional │
│  (read/write)   │        DAEMON (direct)      │  Real-time PTY streaming    │
│                 │                             │  No middleman = fast        │
│                 │                             │                             │
├─────────────────┼─────────────────────────────┼─────────────────────────────┤
│                 │                             │                             │
│  Server Actions │  Frontend ──▶ API ──▶       │  Auth & audit in API        │
│  (start/stop)   │     Redis ──▶ DAEMON        │  Queued, reliable delivery  │
│                 │                             │  Works if daemon temp down  │
│                 │                             │                             │
├─────────────────┼─────────────────────────────┼─────────────────────────────┤
│                 │                             │                             │
│  File Manager   │  Frontend ───WebSocket───▶  │  Large file transfers       │
│  (SFTP-like)    │        DAEMON (direct)      │  Streaming up/downloads     │
│                 │                             │                             │
├─────────────────┼─────────────────────────────┼─────────────────────────────┤
│                 │                             │                             │
│  Metrics/Status │  Daemon ──▶ Redis ──▶ API   │  Broadcast to many users    │
│  (real-time)    │     ──▶ SSE ──▶ Frontend    │  Cached in Redis            │
│                 │                             │  API handles fan-out        │
│                 │                             │                             │
├─────────────────┼─────────────────────────────┼─────────────────────────────┤
│                 │                             │                             │
│  Dashboard/CRUD │  Frontend ──▶ API ──▶       │  Standard REST pattern      │
│                 │     PostgreSQL              │  Persistent data            │
│                 │                             │                             │
└─────────────────┴─────────────────────────────┴─────────────────────────────┘

KEY INSIGHT: Console & Files bypass the API for performance.
             The API only issues a short-lived signed token for auth.
```

---

## 3. Component Deep Dive

### 3.1 Control Plane

#### 3.1.1 Next.js Frontend

**Responsibilities:**
- User interface and experience
- Server-side rendering for SEO
- Client-side state management
- WebSocket connections for real-time updates

**Key Routes:**
```
/                       # Landing page (public)
/auth/signin           # Authentication
/auth/signup           # Registration
/dashboard             # User dashboard
/servers               # Server list
/servers/[id]          # Server management
/servers/[id]/console  # Live console
/servers/[id]/files    # File manager
/nodes                 # Node management (admin)
/settings              # User settings
/admin                 # Admin panel
```

#### 3.1.2 Hono API

**Responsibilities:**
- RESTful API endpoints
- Authentication middleware (Better Auth)
- WebSocket proxy for real-time events
- Redis pub/sub management
- Rate limiting and request validation

**API Structure:**
```
/api/v1
├── /auth                    # Better Auth routes
│   ├── POST /signin
│   ├── POST /signup
│   ├── POST /signout
│   └── GET  /session
├── /users
│   ├── GET    /me
│   └── PATCH  /me
├── /servers
│   ├── GET    /              # List user's servers
│   ├── POST   /              # Create server
│   ├── GET    /:id           # Get server details
│   ├── PATCH  /:id           # Update server
│   ├── DELETE /:id           # Delete server
│   ├── POST   /:id/start     # Start server
│   ├── POST   /:id/stop      # Stop server
│   ├── POST   /:id/restart   # Restart server
│   ├── POST   /:id/kill      # Force kill
│   └── GET    /:id/console-token  # Get console access token
├── /nodes
│   ├── GET    /              # List nodes (admin)
│   ├── POST   /              # Register node
│   ├── GET    /:id           # Node details
│   ├── DELETE /:id           # Remove node
│   └── GET    /:id/stats     # Node statistics
├── /blueprints
│   ├── GET    /              # List available blueprints
│   └── GET    /:id           # Blueprint details
└── /admin
    ├── GET    /users         # List all users
    ├── GET    /stats         # Platform statistics
    └── POST   /nodes/:id/token  # Generate node token
```

#### 3.1.3 PostgreSQL Database

**Responsibilities:**
- Persistent data storage
- User accounts and permissions
- Server configurations
- Audit logging
- Node registry

**Key Characteristics:**
- Single primary instance (can add read replicas)
- Automated backups
- Connection pooling via PgBouncer (optional)

#### 3.1.4 Redis

**Responsibilities:**
- Real-time pub/sub messaging
- Session storage (Better Auth)
- Caching (metrics, server status)
- Job queues (BullMQ pattern)
- Rate limiting counters

**Channel Structure:**
```
# Node Communication
stellar:nodes:{node_id}:commands     # API → Daemon commands
stellar:nodes:{node_id}:events       # Daemon → API events
stellar:nodes:{node_id}:heartbeat    # Daemon health checks

# Server Events
stellar:servers:{server_id}:status   # Status changes
stellar:servers:{server_id}:metrics  # CPU, RAM, etc.
stellar:servers:{server_id}:logs     # Log streaming (optional)

# Global
stellar:events:global                # Platform-wide events
```

**Key Prefixes:**
```
cache:server:{id}:status      # Cached server status (TTL: 30s)
cache:node:{id}:metrics       # Cached node metrics (TTL: 10s)
session:{token}               # User sessions (Better Auth)
ratelimit:{ip}:{endpoint}     # Rate limiting
queue:deployments             # Deployment job queue
queue:backups                 # Backup job queue
```

### 3.2 Node Plane

#### 3.2.1 Rust Daemon

**Responsibilities:**
- Docker container management
- Direct WebSocket server for console access
- Metrics collection and reporting
- File system operations
- Health monitoring
- Secure communication with control plane

**Architecture:**
```rust
// Daemon components
├── main.rs                    // Entry point, config loading
├── api/
│   ├── mod.rs
│   ├── websocket.rs          // WebSocket server for console
│   └── grpc.rs               // Optional gRPC for internal comms
├── docker/
│   ├── mod.rs
│   ├── container.rs          // Container lifecycle
│   ├── images.rs             // Image management
│   └── networks.rs           // Network management
├── redis/
│   ├── mod.rs
│   ├── subscriber.rs         // Command listener
│   └── publisher.rs          // Event publisher
├── metrics/
│   ├── mod.rs
│   ├── collector.rs          // System metrics
│   └── container_stats.rs    // Per-container stats
├── auth/
│   ├── mod.rs
│   ├── token.rs              // JWT validation
│   └── mtls.rs               // mTLS for API comm
└── files/
    ├── mod.rs
    └── manager.rs            // File operations
```

**Key Features:**
- Async runtime (Tokio)
- Zero-copy where possible
- Graceful shutdown handling
- Auto-reconnect to Redis
- Local state persistence (SQLite for queue)

---

## 4. Authentication & Authorization

### 4.1 Overview

StellarStack uses a multi-layered authentication system:

1. **User Authentication** - Better Auth (users accessing the platform)
2. **Daemon Authentication** - mTLS + API tokens (nodes connecting to control plane)
3. **Console Authentication** - Signed JWTs (users accessing server consoles)

### 4.2 User Authentication (Better Auth)

#### 4.2.1 Configuration

```typescript
// apps/api/src/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  session: {
    strategy: "jwt", // or "database" for more control
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },
  advanced: {
    generateId: () => crypto.randomUUID(),
  },
});
```

#### 4.2.2 Session Flow

```
1. User signs in via Better Auth
2. Better Auth creates session (stored in Redis/DB)
3. Session token returned as HTTP-only cookie
4. All API requests include cookie automatically
5. Hono middleware validates session on each request
```

#### 4.2.3 API Middleware

```typescript
// apps/api/src/middleware/auth.ts
import { auth } from "../auth";

export const authMiddleware = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);

  await next();
};
```

### 4.3 Daemon Authentication

#### 4.3.1 Registration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DAEMON REGISTRATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Admin generates registration token
─────────────────────────────────────────
Admin ──▶ POST /api/v1/admin/nodes/token
          {
            "name": "us-west-1",
            "region": "us-west",
            "maxServers": 50
          }
      ◀── {
            "registrationToken": "strk_reg_xxxxx",
            "expiresAt": "2024-12-10T00:00:00Z"
          }

Step 2: Daemon uses token to register
─────────────────────────────────────
Daemon ──▶ POST /api/v1/nodes/register
           Headers: {
             "X-Registration-Token": "strk_reg_xxxxx"
           }
           Body: {
             "publicKey": "-----BEGIN PUBLIC KEY-----...",
             "hostname": "node-us-west.stellarstack.app",
             "port": 5000,
             "specs": {
               "cpu": 8,
               "memory": 32768,
               "disk": 500000
             }
           }
       ◀── {
             "nodeId": "node_xxxxx",
             "apiToken": "strk_node_xxxxx",  // Long-lived API token
             "certificate": "-----BEGIN CERTIFICATE-----..."  // Signed by CA
           }

Step 3: Daemon stores credentials and connects
──────────────────────────────────────────────
Daemon saves:
  - nodeId
  - apiToken (for Redis auth)
  - certificate (for mTLS)
  - CA certificate (to verify control plane)

Daemon connects to Redis with token authentication
Daemon subscribes to: stellar:nodes:{nodeId}:commands
Daemon publishes to: stellar:nodes:{nodeId}:events
```

#### 4.3.2 Token Types

| Token Type | Format | Purpose | Lifetime |
|------------|--------|---------|----------|
| Registration | `strk_reg_xxxxx` | One-time node registration | 24 hours |
| Node API | `strk_node_xxxxx` | Daemon ↔ Redis communication | 1 year (rotatable) |
| Console | `strk_console_xxxxx` | User ↔ Daemon WebSocket | 5 minutes |

#### 4.3.3 mTLS Configuration

```rust
// daemon/src/auth/mtls.rs
use rustls::{Certificate, PrivateKey, ClientConfig};

pub struct MtlsConfig {
    pub ca_cert: Certificate,      // Control plane CA
    pub node_cert: Certificate,    // Node's certificate (signed by CA)
    pub node_key: PrivateKey,      // Node's private key
}

impl MtlsConfig {
    pub fn client_config(&self) -> ClientConfig {
        // Configure mTLS for outbound connections to control plane
    }

    pub fn server_config(&self) -> ServerConfig {
        // Configure mTLS for inbound connections (optional)
    }
}
```

#### 4.3.4 Heartbeat & Health

```rust
// Daemon sends heartbeat every 30 seconds
{
  "type": "heartbeat",
  "nodeId": "node_xxxxx",
  "timestamp": 1702156800,
  "status": "healthy",
  "metrics": {
    "cpuUsage": 45.2,
    "memoryUsage": 68.5,
    "diskUsage": 32.1,
    "activeContainers": 12,
    "networkRx": 1024000,
    "networkTx": 512000
  }
}

// Control plane marks node as unhealthy after 3 missed heartbeats (90s)
// Control plane marks node as offline after 5 missed heartbeats (150s)
```

### 4.4 Role-Based Access Control (RBAC)

#### 4.4.1 Role Hierarchy

```
Super Admin
    │
    ├── Admin
    │     │
    │     ├── Moderator
    │     │
    │     └── Support
    │
    └── User (default)
          │
          └── Subuser (per-server)
```

#### 4.4.2 Permission Matrix

```typescript
// types/permissions.ts
export const PERMISSIONS = {
  // Server permissions
  "server.view": "View server details",
  "server.console": "Access server console",
  "server.console.send": "Send console commands",
  "server.files.read": "Read server files",
  "server.files.write": "Write server files",
  "server.files.delete": "Delete server files",
  "server.start": "Start server",
  "server.stop": "Stop server",
  "server.restart": "Restart server",
  "server.kill": "Force kill server",
  "server.delete": "Delete server",
  "server.settings": "Modify server settings",
  "server.subusers": "Manage subusers",
  "server.schedules": "Manage schedules",
  "server.backups": "Manage backups",
  "server.databases": "Manage databases",

  // Node permissions (admin only)
  "node.view": "View node details",
  "node.create": "Create nodes",
  "node.delete": "Delete nodes",
  "node.settings": "Modify node settings",

  // User permissions (admin only)
  "user.view": "View user details",
  "user.create": "Create users",
  "user.delete": "Delete users",
  "user.suspend": "Suspend users",
  "user.servers": "Manage user servers",

  // Platform permissions (super admin only)
  "platform.settings": "Modify platform settings",
  "platform.blueprints": "Manage blueprints",
  "platform.billing": "Access billing",
} as const;
```

#### 4.4.3 Permission Check Flow

```typescript
// middleware/permission.ts
export const requirePermission = (permission: string) => {
  return async (c, next) => {
    const user = c.get("user");
    const serverId = c.req.param("serverId");

    // Check if user has permission
    const hasPermission = await checkPermission(user.id, serverId, permission);

    if (!hasPermission) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  };
};

// Usage
app.post("/servers/:serverId/start",
  authMiddleware,
  requirePermission("server.start"),
  startServerHandler
);
```

---

## 5. Daemon Registration & Management

### 5.1 Registration Process

#### 5.1.1 Pre-requisites

Before registering a daemon:
1. Server must have Docker installed
2. Server must have outbound access to Redis (port 6379)
3. Server must have a public IP or domain
4. Server must have ports 5000 (daemon) open

#### 5.1.2 Installation Script

```bash
#!/bin/bash
# install-daemon.sh

set -e

STELLARSTACK_API="https://api.stellarstack.app"
REGISTRATION_TOKEN="$1"

if [ -z "$REGISTRATION_TOKEN" ]; then
  echo "Usage: ./install-daemon.sh <registration_token>"
  exit 1
fi

echo "Installing StellarStack Daemon..."

# Create directories
mkdir -p /etc/stellarstack
mkdir -p /var/lib/stellarstack
mkdir -p /var/log/stellarstack

# Download daemon binary
curl -L "$STELLARSTACK_API/downloads/daemon/latest/linux-amd64" \
  -o /usr/local/bin/stellarstack-daemon
chmod +x /usr/local/bin/stellarstack-daemon

# Detect system specs
CPU_CORES=$(nproc)
MEMORY_MB=$(free -m | awk '/^Mem:/{print $2}')
DISK_MB=$(df -m / | awk 'NR==2{print $4}')
PUBLIC_IP=$(curl -s ifconfig.me)

# Register with control plane
RESPONSE=$(curl -s -X POST "$STELLARSTACK_API/api/v1/nodes/register" \
  -H "X-Registration-Token: $REGISTRATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"hostname\": \"$PUBLIC_IP\",
    \"port\": 5000,
    \"specs\": {
      \"cpu\": $CPU_CORES,
      \"memory\": $MEMORY_MB,
      \"disk\": $DISK_MB
    }
  }")

# Extract credentials
NODE_ID=$(echo $RESPONSE | jq -r '.nodeId')
API_TOKEN=$(echo $RESPONSE | jq -r '.apiToken')
CERTIFICATE=$(echo $RESPONSE | jq -r '.certificate')
REDIS_URL=$(echo $RESPONSE | jq -r '.redisUrl')

# Write config
cat > /etc/stellarstack/daemon.toml << EOF
[node]
id = "$NODE_ID"
api_token = "$API_TOKEN"

[redis]
url = "$REDIS_URL"

[server]
host = "0.0.0.0"
port = 5000

[docker]
socket = "/var/run/docker.sock"

[logging]
level = "info"
file = "/var/log/stellarstack/daemon.log"
EOF

# Write certificate
echo "$CERTIFICATE" > /etc/stellarstack/node.crt

# Create systemd service
cat > /etc/systemd/system/stellarstack-daemon.service << EOF
[Unit]
Description=StellarStack Daemon
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/stellarstack-daemon --config /etc/stellarstack/daemon.toml
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable stellarstack-daemon
systemctl start stellarstack-daemon

echo "StellarStack Daemon installed successfully!"
echo "Node ID: $NODE_ID"
```

### 5.2 Daemon Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DAEMON LIFECYCLE                                    │
└──────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   OFFLINE   │
                    └──────┬──────┘
                           │
                    (Registration)
                           │
                           ▼
                    ┌─────────────┐
           ┌───────│  STARTING   │───────┐
           │       └──────┬──────┘       │
           │              │              │
      (Failed)     (Connected)     (Timeout)
           │              │              │
           ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │    ERROR    │ │   ONLINE    │ │  UNHEALTHY  │
    └─────────────┘ └──────┬──────┘ └──────┬──────┘
                           │              │
                    (Missed heartbeats)   │
                           │              │
                           └──────┬───────┘
                                  │
                           (Recovery or)
                           (Admin action)
                                  │
                                  ▼
                           ┌─────────────┐
                           │  DRAINING   │──── (Move servers)
                           └──────┬──────┘
                                  │
                           (All servers moved)
                                  │
                                  ▼
                           ┌─────────────┐
                           │   OFFLINE   │
                           └─────────────┘
```

### 5.3 Node Management Commands

```typescript
// Redis command structure
interface NodeCommand {
  id: string;          // Unique command ID
  type: string;        // Command type
  payload: any;        // Command-specific data
  timestamp: number;   // Unix timestamp
  expiresAt: number;   // Command expiration
}

// Command types
type CommandType =
  | "server.create"
  | "server.start"
  | "server.stop"
  | "server.restart"
  | "server.kill"
  | "server.delete"
  | "server.reinstall"
  | "files.read"
  | "files.write"
  | "files.delete"
  | "backup.create"
  | "backup.restore"
  | "node.update"
  | "node.drain"
  | "node.shutdown";
```

---

## 6. Console Access & Permissions

### 6.1 Console Token Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CONSOLE ACCESS FLOW                                   │
└──────────────────────────────────────────────────────────────────────────────┘

Step 1: User requests console access
────────────────────────────────────
User ──▶ GET /api/v1/servers/{serverId}/console-token
         Headers: { Cookie: session_token }

Step 2: API validates permissions
─────────────────────────────────
API checks:
  ├── Is user authenticated? (Better Auth session)
  ├── Does user own this server OR have subuser access?
  ├── Does user have "server.console" permission?
  └── Is server on an online node?

Step 3: API generates signed console token
──────────────────────────────────────────
API ──▶ {
          "consoleToken": "strk_console_xxxxx",
          "nodeHost": "node-us-west.stellarstack.app",
          "nodePort": 5000,
          "expiresAt": "2024-12-09T12:05:00Z",  // 5 minutes
          "permissions": {
            "canRead": true,
            "canWrite": true  // Based on "server.console.send" permission
          }
        }

Step 4: Frontend connects directly to daemon
────────────────────────────────────────────
Frontend ──▶ WebSocket: wss://node-us-west.stellarstack.app:5000/console
             Headers: {
               "Authorization": "Bearer strk_console_xxxxx"
             }

Step 5: Daemon validates token
──────────────────────────────
Daemon:
  ├── Verifies JWT signature (using shared secret or public key)
  ├── Checks token expiration
  ├── Checks serverId matches requested container
  └── Extracts permissions (canRead, canWrite)

Step 6: Console session established
───────────────────────────────────
Daemon ──▶ Docker: attach to container PTY
         ◀── Stream stdout/stderr to WebSocket
         ──▶ Stream WebSocket input to stdin (if canWrite)
```

### 6.2 Console Token Structure

```typescript
// JWT payload for console tokens
interface ConsoleTokenPayload {
  // Standard JWT claims
  iss: "stellarstack";
  sub: string;        // User ID
  aud: string;        // Node ID
  exp: number;        // Expiration (Unix timestamp)
  iat: number;        // Issued at
  jti: string;        // Unique token ID

  // Custom claims
  serverId: string;
  containerId: string;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
  };
  metadata: {
    username: string;
    ip: string;
  };
}
```

### 6.3 Daemon WebSocket Handler

```rust
// daemon/src/api/websocket.rs
use axum::extract::ws::{WebSocket, WebSocketUpgrade};
use jsonwebtoken::{decode, DecodingKey, Validation};

pub async fn console_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Extract and validate token
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AuthError::MissingToken)?;

    let claims = decode::<ConsoleTokenPayload>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )?;

    // Verify container exists and is running
    let container = docker.containers()
        .get(&claims.claims.containerId)
        .inspect()
        .await?;

    if container.state.status != "running" {
        return Err(ConsoleError::ContainerNotRunning);
    }

    // Upgrade to WebSocket and handle console
    ws.on_upgrade(move |socket| {
        handle_console_session(socket, claims.claims, container)
    })
}

async fn handle_console_session(
    mut socket: WebSocket,
    claims: ConsoleTokenPayload,
    container: ContainerInspect,
) {
    // Attach to container
    let mut exec = docker.containers()
        .get(&claims.containerId)
        .exec(&ExecCreateOptions {
            attach_stdin: Some(claims.permissions.canWrite),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            tty: Some(true),
            cmd: Some(vec!["/bin/sh"]),
            ..Default::default()
        })
        .await?;

    // Bidirectional stream
    loop {
        tokio::select! {
            // Container output -> WebSocket
            Some(output) = exec.output.next() => {
                socket.send(Message::Binary(output)).await?;
            }
            // WebSocket input -> Container (if permitted)
            Some(Ok(msg)) = socket.recv() => {
                if claims.permissions.canWrite {
                    if let Message::Binary(data) = msg {
                        exec.input.write_all(&data).await?;
                    }
                }
            }
            else => break,
        }
    }

    // Log session end
    audit_log::console_session_ended(&claims).await;
}
```

### 6.4 Console Audit Logging

```typescript
// All console activity is logged
interface ConsoleAuditLog {
  id: string;
  userId: string;
  serverId: string;
  nodeId: string;
  action: "session_start" | "session_end" | "command_sent";
  data?: {
    command?: string;     // For command_sent
    duration?: number;    // For session_end
  };
  ip: string;
  userAgent: string;
  timestamp: Date;
}
```

---

## 7. Real-time Communication

### 7.1 Event Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         EVENT FLOW ARCHITECTURE                               │
└──────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │       Redis         │
                         │    (Pub/Sub Hub)    │
                         └──────────┬──────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│    Daemon 1   │          │    Daemon 2   │          │   Hono API    │
│               │          │               │          │               │
│ Publishes:    │          │ Publishes:    │          │ Subscribes:   │
│ - Status      │          │ - Status      │          │ - All nodes   │
│ - Metrics     │          │ - Metrics     │          │ - All servers │
│ - Events      │          │ - Events      │          │               │
│               │          │               │          │ Broadcasts:   │
│ Subscribes:   │          │ Subscribes:   │          │ - SSE         │
│ - Commands    │          │ - Commands    │          │ - WebSocket   │
└───────────────┘          └───────────────┘          └───────┬───────┘
                                                              │
                                                              ▼
                                                     ┌───────────────┐
                                                     │   Frontend    │
                                                     │   (Next.js)   │
                                                     │               │
                                                     │ Receives:     │
                                                     │ - SSE stream  │
                                                     │ - WS updates  │
                                                     └───────────────┘
```

### 7.2 Event Types

```typescript
// events/types.ts

// Server events (from daemon)
interface ServerStatusEvent {
  type: "server.status";
  serverId: string;
  nodeId: string;
  status: "starting" | "running" | "stopping" | "stopped" | "crashed";
  timestamp: number;
}

interface ServerMetricsEvent {
  type: "server.metrics";
  serverId: string;
  nodeId: string;
  metrics: {
    cpu: number;        // Percentage (0-100)
    memory: number;     // Bytes used
    memoryLimit: number; // Bytes allocated
    disk: number;       // Bytes used
    networkRx: number;  // Bytes received
    networkTx: number;  // Bytes transmitted
    uptime: number;     // Seconds
  };
  timestamp: number;
}

interface ServerLogEvent {
  type: "server.log";
  serverId: string;
  nodeId: string;
  log: {
    stream: "stdout" | "stderr";
    message: string;
    timestamp: number;
  };
}

// Node events (from daemon)
interface NodeHeartbeatEvent {
  type: "node.heartbeat";
  nodeId: string;
  status: "healthy" | "degraded";
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    containers: number;
    networkRx: number;
    networkTx: number;
  };
  timestamp: number;
}

interface NodeAlertEvent {
  type: "node.alert";
  nodeId: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
}

// Command events (from API)
interface ServerCommandEvent {
  type: "server.command";
  commandId: string;
  serverId: string;
  command: "start" | "stop" | "restart" | "kill";
  userId: string;
  timestamp: number;
}
```

### 7.3 SSE Implementation (Hono)

```typescript
// api/src/routes/events.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { redis } from "../redis";

const events = new Hono();

events.get("/stream", authMiddleware, async (c) => {
  const user = c.get("user");

  // Get user's servers for filtering
  const userServers = await db.server.findMany({
    where: { userId: user.id },
    select: { id: true, nodeId: true },
  });

  const serverIds = new Set(userServers.map(s => s.id));
  const nodeIds = new Set(userServers.map(s => s.nodeId));

  return streamSSE(c, async (stream) => {
    // Subscribe to relevant Redis channels
    const subscriber = redis.duplicate();

    const channels = [
      ...Array.from(nodeIds).map(id => `stellar:nodes:${id}:events`),
      ...Array.from(serverIds).map(id => `stellar:servers:${id}:status`),
      ...Array.from(serverIds).map(id => `stellar:servers:${id}:metrics`),
    ];

    await subscriber.subscribe(...channels);

    subscriber.on("message", async (channel, message) => {
      const event = JSON.parse(message);

      // Only send events for user's servers
      if (event.serverId && !serverIds.has(event.serverId)) {
        return;
      }

      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });

    // Keep connection alive
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: Date.now() }),
      });
    }, 30000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
      subscriber.unsubscribe();
      subscriber.quit();
    });
  });
});

export default events;
```

### 7.4 Frontend Event Handler

```typescript
// hooks/useServerEvents.ts
import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useServerEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/api/v1/events/stream", {
      withCredentials: true,
    });

    eventSource.addEventListener("server.status", (e) => {
      const event = JSON.parse(e.data);

      // Update React Query cache
      queryClient.setQueryData(
        ["server", event.serverId],
        (old) => old ? { ...old, status: event.status } : old
      );
    });

    eventSource.addEventListener("server.metrics", (e) => {
      const event = JSON.parse(e.data);

      queryClient.setQueryData(
        ["server", event.serverId, "metrics"],
        event.metrics
      );
    });

    eventSource.addEventListener("node.heartbeat", (e) => {
      const event = JSON.parse(e.data);

      queryClient.setQueryData(
        ["node", event.nodeId, "status"],
        { status: event.status, metrics: event.metrics }
      );
    });

    eventSource.onerror = () => {
      // Reconnect logic
      setTimeout(() => {
        eventSource.close();
        // Re-initialize
      }, 5000);
    };

    return () => eventSource.close();
  }, [queryClient]);
}
```

---

## 8. Deployment Strategies

This section covers how game servers are deployed, updated, and managed.

### 8.1 Single-Click Deployment

"Single-click deployment" means a user can go from nothing to a running game server with minimal configuration. The system handles all the complexity: pulling images, configuring containers, allocating ports, and starting services.

#### 8.1.1 User Experience Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      SINGLE-CLICK DEPLOYMENT (USER VIEW)                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: Select Game                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │Minecraft│ │  Rust   │ │Valheim  │ │  ARK    │ │  CS2    │  ...          │
│  │   ⬜    │ │   ⬜    │ │   ⬜    │ │   ⬜    │ │   ⬜    │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: Configure Server                                                    │
│                                                                              │
│  Server Name:     [My Minecraft Server      ]                               │
│  Version:         [1.20.4 (Recommended)  ▼]                                 │
│  Server Type:     [Paper ▼]  (Vanilla, Spigot, Fabric, Forge)              │
│                                                                              │
│  ── Resources ──────────────────────────────────────                        │
│  RAM:    [4 GB ▼]     CPU: [2 Cores ▼]    Disk: [10 GB ▼]                  │
│                                                                              │
│  ── Game Settings ──────────────────────────────────                        │
│  Max Players:     [20        ]                                              │
│  Server MOTD:     [Welcome to my server!    ]                               │
│  Game Mode:       [Survival ▼]                                              │
│                                                                              │
│  ── Location ───────────────────────────────────────                        │
│  Node:  ( ) Auto-select (best ping)                                         │
│         (●) US-West-1 (45ms)                                                │
│         ( ) US-East-1 (78ms)                                                │
│         ( ) EU-West-1 (120ms)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: Deploy (One Click)                                                  │
│                                                                              │
│                    ┌──────────────────────┐                                 │
│                    │   🚀 Deploy Server   │                                 │
│                    └──────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: Real-time Progress                                                  │
│                                                                              │
│  ✓ Validating configuration...                                              │
│  ✓ Reserving resources on US-West-1...                                      │
│  ◐ Pulling Docker image... (45%)  ████████░░░░░░░░                          │
│  ○ Creating container...                                                    │
│  ○ Starting server...                                                       │
│  ○ Waiting for ready signal...                                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Console output streaming live...                                       │ │
│  │ > Loading libraries, please wait...                                    │ │
│  │ > Starting minecraft server version 1.20.4                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: Server Ready!                                                       │
│                                                                              │
│  ✅ Your server is online!                                                  │
│                                                                              │
│  Connect: 45.33.128.72:25565                    [📋 Copy]                   │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        │
│  │   Console    │ │    Files     │ │   Settings   │                        │
│  └──────────────┘ └──────────────┘ └──────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 8.1.2 Technical Deployment Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      SINGLE-CLICK DEPLOYMENT (TECHNICAL)                      │
└──────────────────────────────────────────────────────────────────────────────┘

Step 1: User selects blueprint
──────────────────────────────
User ──▶ Browse blueprints (Minecraft, Rust, Valheim, etc.)
     ──▶ Select version, configure settings
     ──▶ Choose node (or auto-select based on region/capacity)

Step 2: API creates deployment job
──────────────────────────────────
API ──▶ Validate user quotas
    ──▶ Reserve resources on node
    ──▶ Create server record in PostgreSQL
    ──▶ Queue deployment job in Redis

Step 3: Job processor handles deployment
────────────────────────────────────────
Job Worker ──▶ Publish command to node
           ──▶ stellar:nodes:{nodeId}:commands
               {
                 "type": "server.create",
                 "serverId": "srv_xxxxx",
                 "blueprint": "minecraft-paper",
                 "version": "1.20.4",
                 "config": {
                   "memory": 4096,
                   "cpu": 2,
                   "ports": [25565],
                   "env": {
                     "EULA": "true",
                     "MAX_PLAYERS": "20"
                   }
                 }
               }

Step 4: Daemon executes deployment
──────────────────────────────────
Daemon ──▶ Pull Docker image (if not cached)
       ──▶ Create container with resource limits
       ──▶ Configure networking (allocate ports)
       ──▶ Mount volumes (server files, backups)
       ──▶ Start container
       ──▶ Publish status updates

Step 5: User sees real-time progress
────────────────────────────────────
Frontend ◀── SSE: { "type": "deployment.progress", "step": "pulling_image", "progress": 45 }
         ◀── SSE: { "type": "deployment.progress", "step": "creating_container" }
         ◀── SSE: { "type": "deployment.progress", "step": "starting" }
         ◀── SSE: { "type": "server.status", "status": "running" }
```

#### 8.1.2 Blueprint Structure

```typescript
// blueprints/minecraft-paper.ts
interface Blueprint {
  id: string;
  name: string;
  description: string;
  category: "minecraft" | "rust" | "valheim" | "ark" | "other";
  icon: string;

  // Docker configuration
  docker: {
    image: string;
    tag: string;
    registry?: string;  // Default: Docker Hub
  };

  // Default resource allocation
  resources: {
    memory: number;     // MB
    cpu: number;        // CPU shares (1024 = 1 core)
    disk: number;       // MB
    swap?: number;      // MB
  };

  // Networking
  ports: {
    container: number;
    protocol: "tcp" | "udp";
    description: string;
  }[];

  // Environment variables
  environment: {
    key: string;
    default: string;
    description: string;
    required: boolean;
    userConfigurable: boolean;
  }[];

  // Volume mounts
  volumes: {
    container: string;
    description: string;
    backup: boolean;    // Include in backups
  }[];

  // Startup configuration
  startup: {
    command?: string;
    readyCheck: {
      type: "log" | "port" | "http";
      pattern?: string;   // For log check
      timeout: number;    // Seconds
    };
  };

  // Available versions
  versions: {
    tag: string;
    name: string;
    recommended: boolean;
  }[];
}

// Example: Minecraft Paper
export const minecraftPaper: Blueprint = {
  id: "minecraft-paper",
  name: "Minecraft Paper",
  description: "High-performance Minecraft server",
  category: "minecraft",
  icon: "/blueprints/minecraft.svg",

  docker: {
    image: "itzg/minecraft-server",
    tag: "latest",
  },

  resources: {
    memory: 4096,
    cpu: 2048,
    disk: 10240,
  },

  ports: [
    { container: 25565, protocol: "tcp", description: "Game port" },
    { container: 25575, protocol: "tcp", description: "RCON port" },
  ],

  environment: [
    { key: "EULA", default: "true", description: "Accept EULA", required: true, userConfigurable: false },
    { key: "TYPE", default: "PAPER", description: "Server type", required: true, userConfigurable: false },
    { key: "VERSION", default: "1.20.4", description: "Minecraft version", required: true, userConfigurable: true },
    { key: "MEMORY", default: "4G", description: "Java heap size", required: true, userConfigurable: false },
    { key: "MAX_PLAYERS", default: "20", description: "Max players", required: false, userConfigurable: true },
    { key: "MOTD", default: "A Minecraft Server", description: "Server message", required: false, userConfigurable: true },
  ],

  volumes: [
    { container: "/data", description: "Server data", backup: true },
  ],

  startup: {
    readyCheck: {
      type: "log",
      pattern: "Done \\([0-9.]+s\\)! For help, type \"help\"",
      timeout: 300,
    },
  },

  versions: [
    { tag: "1.20.4", name: "1.20.4 (Latest)", recommended: true },
    { tag: "1.20.2", name: "1.20.2", recommended: false },
    { tag: "1.19.4", name: "1.19.4", recommended: false },
  ],
};
```

### 8.2 Deployment Configuration

```typescript
// User's deployment configuration
interface DeploymentConfig {
  blueprintId: string;
  version: string;
  nodeId?: string;          // Optional: auto-select if not provided
  name: string;

  resources: {
    memory: number;
    cpu: number;
    disk: number;
  };

  environment: Record<string, string>;

  allocation: {
    primary: number;        // Primary port
    additional?: number[];  // Additional ports
  };

  autoStart: boolean;
}
```

---

## 9. Auto-scaling (Optional)

> **Note**: Auto-scaling is an **optional feature** for operators who want to automatically provision new nodes from cloud providers. Most operators will manually add nodes (their own hardware, pre-purchased VPS, etc.). This section is for hosting providers who want dynamic scaling.

### 9.1 Auto-scaling Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AUTO-SCALING ARCHITECTURE                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTROL PLANE                                   │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │  Scaling Engine  │◀──▶│   Node Registry  │◀──▶│  Cloud Provider  │       │
│  │                  │    │                  │    │     Adapters     │       │
│  │  - Monitor load  │    │  - Track nodes   │    │                  │       │
│  │  - Apply rules   │    │  - Track capacity│    │  - Hetzner       │       │
│  │  - Trigger scale │    │  - Health status │    │  - DigitalOcean  │       │
│  └────────┬─────────┘    └──────────────────┘    │  - Vultr         │       │
│           │                                       │  - AWS           │       │
│           │                                       │  - Custom        │       │
│           ▼                                       └──────────────────┘       │
│  ┌──────────────────┐                                                        │
│  │   Metrics Store  │                                                        │
│  │     (Redis)      │                                                        │
│  └──────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Scale Up/Down
                                    ▼
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
   ┌─────────┐                 ┌─────────┐                 ┌─────────┐
   │ Node 1  │                 │ Node 2  │                 │ Node N  │
   │ (Base)  │                 │ (Scaled)│                 │(Pending)│
   └─────────┘                 └─────────┘                 └─────────┘
```

### 9.2 Scaling Rules

```typescript
// config/scaling.ts
interface ScalingRule {
  id: string;
  name: string;
  enabled: boolean;

  // Conditions (ALL must be true)
  conditions: {
    metric: "cpu" | "memory" | "disk" | "servers" | "connections";
    operator: "gt" | "lt" | "gte" | "lte";
    threshold: number;
    duration: number;  // Seconds the condition must be true
  }[];

  // Action to take
  action: {
    type: "scale_up" | "scale_down" | "alert";
    provider?: string;      // For scale actions
    nodeSpec?: string;      // Node specification ID
    count?: number;         // Number of nodes
    cooldown: number;       // Seconds before rule can trigger again
  };
}

// Example rules
const scalingRules: ScalingRule[] = [
  {
    id: "high-cpu-scale-up",
    name: "Scale up on high CPU",
    enabled: true,
    conditions: [
      { metric: "cpu", operator: "gt", threshold: 80, duration: 300 },
    ],
    action: {
      type: "scale_up",
      provider: "hetzner",
      nodeSpec: "cx41",
      count: 1,
      cooldown: 600,
    },
  },
  {
    id: "low-usage-scale-down",
    name: "Scale down on low usage",
    enabled: true,
    conditions: [
      { metric: "cpu", operator: "lt", threshold: 20, duration: 1800 },
      { metric: "servers", operator: "lt", threshold: 5, duration: 1800 },
    ],
    action: {
      type: "scale_down",
      cooldown: 3600,
    },
  },
];
```

### 9.3 Cloud Provider Adapters

```typescript
// providers/interface.ts
interface CloudProviderAdapter {
  name: string;

  // List available node specifications
  listSpecs(): Promise<NodeSpec[]>;

  // Provision a new node
  createNode(spec: NodeSpec, options: CreateNodeOptions): Promise<ProvisionedNode>;

  // Destroy a node
  destroyNode(nodeId: string): Promise<void>;

  // Get node status
  getNodeStatus(nodeId: string): Promise<NodeStatus>;

  // List all nodes
  listNodes(): Promise<ProvisionedNode[]>;
}

interface NodeSpec {
  id: string;
  name: string;
  cpu: number;
  memory: number;      // MB
  disk: number;        // GB
  bandwidth: number;   // TB
  price: {
    hourly: number;
    monthly: number;
    currency: string;
  };
  locations: string[];
}

interface CreateNodeOptions {
  name: string;
  location: string;
  sshKeys?: string[];
  userData?: string;    // Cloud-init script
  tags?: string[];
}

interface ProvisionedNode {
  id: string;
  providerId: string;   // Provider's internal ID
  name: string;
  status: "provisioning" | "running" | "stopping" | "stopped";
  ip: string;
  spec: NodeSpec;
  location: string;
  createdAt: Date;
}
```

### 9.4 Hetzner Adapter Example

```typescript
// providers/hetzner.ts
import { HetznerCloud } from "hcloud-js";

export class HetznerAdapter implements CloudProviderAdapter {
  name = "hetzner";
  private client: HetznerCloud;

  constructor(apiToken: string) {
    this.client = new HetznerCloud({ token: apiToken });
  }

  async listSpecs(): Promise<NodeSpec[]> {
    const serverTypes = await this.client.serverTypes.getAll();

    return serverTypes.map(type => ({
      id: type.name,
      name: type.description,
      cpu: type.cores,
      memory: type.memory * 1024,  // GB to MB
      disk: type.disk,
      bandwidth: 20,  // Hetzner includes 20TB
      price: {
        hourly: type.prices[0].price_hourly.gross,
        monthly: type.prices[0].price_monthly.gross,
        currency: "EUR",
      },
      locations: type.prices.map(p => p.location),
    }));
  }

  async createNode(spec: NodeSpec, options: CreateNodeOptions): Promise<ProvisionedNode> {
    const result = await this.client.servers.create({
      name: options.name,
      server_type: spec.id,
      location: options.location,
      image: "ubuntu-22.04",
      ssh_keys: options.sshKeys,
      user_data: options.userData || this.getCloudInitScript(),
      labels: {
        "stellarstack": "true",
        "managed": "true",
        ...options.tags?.reduce((acc, tag) => ({ ...acc, [tag]: "true" }), {}),
      },
    });

    return {
      id: `hetzner-${result.server.id}`,
      providerId: String(result.server.id),
      name: result.server.name,
      status: "provisioning",
      ip: result.server.public_net.ipv4.ip,
      spec,
      location: options.location,
      createdAt: new Date(result.server.created),
    };
  }

  private getCloudInitScript(): string {
    return `#!/bin/bash
set -e

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install StellarStack daemon
curl -fsSL https://stellarstack.app/install-daemon.sh | bash -s -- AUTO_REGISTER

# Signal ready
curl -X POST https://api.stellarstack.app/internal/node-ready \
  -H "X-Node-Secret: \${NODE_SECRET}"
`;
  }

  async destroyNode(nodeId: string): Promise<void> {
    const providerId = nodeId.replace("hetzner-", "");
    await this.client.servers.delete(Number(providerId));
  }

  async getNodeStatus(nodeId: string): Promise<NodeStatus> {
    const providerId = nodeId.replace("hetzner-", "");
    const server = await this.client.servers.get(Number(providerId));

    return {
      status: server.status as any,
      ip: server.public_net.ipv4.ip,
    };
  }

  async listNodes(): Promise<ProvisionedNode[]> {
    const servers = await this.client.servers.getAll({
      label_selector: "stellarstack=true",
    });

    return servers.map(server => ({
      id: `hetzner-${server.id}`,
      providerId: String(server.id),
      name: server.name,
      status: server.status as any,
      ip: server.public_net.ipv4.ip,
      spec: {} as NodeSpec,  // Would need to lookup
      location: server.datacenter.location.name,
      createdAt: new Date(server.created),
    }));
  }
}
```

### 9.5 Scaling Engine

```typescript
// services/scaling-engine.ts
export class ScalingEngine {
  private rules: ScalingRule[];
  private cooldowns: Map<string, number> = new Map();

  async evaluate() {
    const nodes = await this.nodeRegistry.getAll();
    const aggregateMetrics = this.calculateAggregateMetrics(nodes);

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (this.isOnCooldown(rule.id)) continue;

      const conditionsMet = await this.evaluateConditions(
        rule.conditions,
        aggregateMetrics
      );

      if (conditionsMet) {
        await this.executeAction(rule);
        this.setCooldown(rule.id, rule.action.cooldown);
      }
    }
  }

  private async executeAction(rule: ScalingRule) {
    switch (rule.action.type) {
      case "scale_up":
        await this.scaleUp(rule.action);
        break;
      case "scale_down":
        await this.scaleDown(rule.action);
        break;
      case "alert":
        await this.sendAlert(rule);
        break;
    }
  }

  private async scaleUp(action: ScalingRule["action"]) {
    const provider = this.providers.get(action.provider!);
    const spec = await provider.getSpec(action.nodeSpec!);

    // Find best location based on current distribution
    const location = await this.selectLocation(provider);

    // Create node
    const node = await provider.createNode(spec, {
      name: `stellar-auto-${Date.now()}`,
      location,
      tags: ["auto-scaled"],
    });

    // Wait for node to be ready and daemon to register
    await this.waitForNodeReady(node.id);

    // Log scaling event
    await this.audit.log({
      type: "auto_scale_up",
      nodeId: node.id,
      provider: action.provider,
      spec: action.nodeSpec,
    });
  }

  private async scaleDown(action: ScalingRule["action"]) {
    // Find candidate node (lowest utilization, auto-scaled, no servers)
    const candidate = await this.findScaleDownCandidate();

    if (!candidate) return;

    // Drain node (move any servers)
    await this.drainNode(candidate.id);

    // Destroy node
    const provider = this.providers.get(candidate.provider);
    await provider.destroyNode(candidate.providerId);

    // Remove from registry
    await this.nodeRegistry.remove(candidate.id);

    // Log scaling event
    await this.audit.log({
      type: "auto_scale_down",
      nodeId: candidate.id,
    });
  }
}
```

---

## 10. Version Control & Updates

This section covers versioning for all components: the panel itself, daemons, blueprints, and game servers.

### 10.1 What Gets Versioned?

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         VERSION CONTROL OVERVIEW                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PANEL (Control Plane)                                                     │
│    What: Next.js frontend + Hono API + Database schema                      │
│    Who updates: Operator (self-hosted)                                       │
│    How: Pull new Docker images, run migrations                              │
│    Frequency: Monthly releases, security patches as needed                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. DAEMON                                                                    │
│    What: Rust binary on each node                                           │
│    Who updates: Panel pushes updates to nodes                               │
│    How: Automatic download + restart via systemd                            │
│    Frequency: With panel releases or security patches                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. BLUEPRINTS                                                                │
│    What: Game server templates (Docker images, configs)                     │
│    Who updates: StellarStack team + community contributors                  │
│    How: Sync from blueprint repository                                      │
│    Frequency: When new games/versions release                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. GAME SERVERS                                                              │
│    What: Individual game server instances                                   │
│    Who updates: End users (server owners)                                   │
│    How: Reinstall with new version, or in-place update                     │
│    Frequency: User choice (can auto-update or pin version)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Component Versioning Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         VERSION CONTROL STRATEGY                              │
└──────────────────────────────────────────────────────────────────────────────┘

Component           │ Versioning    │ Update Strategy
────────────────────┼───────────────┼─────────────────────────────────
Control Plane       │ Semantic      │ Rolling deployment
  - Next.js         │ (vX.Y.Z)      │ Zero-downtime
  - Hono API        │               │
────────────────────┼───────────────┼─────────────────────────────────
Daemon              │ Semantic      │ Phased rollout
                    │ (vX.Y.Z)      │ Per-node updates
                    │               │ Automatic rollback
────────────────────┼───────────────┼─────────────────────────────────
Blueprints          │ Independent   │ Instant availability
                    │ (per game)    │ No daemon update needed
────────────────────┼───────────────┼─────────────────────────────────
Game Servers        │ Per-game      │ User-initiated
                    │ (1.20.4, etc) │ Backup → Update → Verify
────────────────────┼───────────────┼─────────────────────────────────
Database Schema     │ Migrations    │ Forward-compatible
                    │ (sequential)  │ Prisma migrate
```

### 10.3 Panel Updates (For Operators)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PANEL UPDATE FLOW                                     │
└──────────────────────────────────────────────────────────────────────────────┘

Step 1: Check for updates
─────────────────────────
Operator sees notification in admin panel:
  "StellarStack v1.5.0 available (current: v1.4.2)"
  - New features: [list]
  - Bug fixes: [list]
  - Breaking changes: [list]
  - Migration required: Yes/No

Step 2: Backup
──────────────
$ docker exec stellarstack-db pg_dump -U postgres stellarstack > backup.sql
$ cp -r ./data ./data.backup

Step 3: Pull new images
───────────────────────
$ docker pull ghcr.io/stellarstack/web:v1.5.0
$ docker pull ghcr.io/stellarstack/api:v1.5.0

Step 4: Run migrations
──────────────────────
$ docker exec stellarstack-api pnpm prisma migrate deploy

Step 5: Restart services
────────────────────────
$ docker-compose up -d

Step 6: Verify
──────────────
- Check /health endpoint
- Verify all nodes reconnected
- Test critical functionality

ROLLBACK (if needed):
$ docker-compose down
$ docker tag ghcr.io/stellarstack/api:v1.4.2 ghcr.io/stellarstack/api:latest
$ psql stellarstack < backup.sql
$ docker-compose up -d
```

### 10.4 Game Server Updates (For End Users)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    GAME SERVER VERSION UPDATE FLOW                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  User Dashboard - Server Settings                                            │
│                                                                              │
│  Current Version: Minecraft 1.20.4 (Paper)                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️  Update Available: Minecraft 1.21                                │   │
│  │                                                                       │   │
│  │  Changes:                                                             │   │
│  │  • New copper and tuff blocks                                        │   │
│  │  • Trial chambers and breeze mob                                     │   │
│  │  • New enchantments                                                  │   │
│  │                                                                       │   │
│  │  ⚠️  Warning: Some plugins may not be compatible                     │   │
│  │                                                                       │   │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │   │
│  │  │   Update Server    │  │   View Changelog   │                     │   │
│  │  └────────────────────┘  └────────────────────┘                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Update Options:                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ (●) Create backup before update (recommended)                        │   │
│  │ ( ) Keep server files, only update JAR                               │   │
│  │ ( ) Fresh install (warning: deletes world!)                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Auto-Update Settings:                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ [ ] Enable automatic updates                                         │   │
│  │     Update to: [Patch versions only ▼] (1.20.4 → 1.20.5)            │   │
│  │     Schedule:  [During low activity ▼] (4 AM server time)           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

TECHNICAL FLOW:
───────────────

User clicks "Update Server"
          │
          ▼
┌─────────────────┐
│ 1. Stop server  │──▶ Graceful shutdown, warn players
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Backup       │──▶ Snapshot server files to storage
└────────┬────────┘    (world, configs, plugins)
         │
         ▼
┌─────────────────┐
│ 3. Pull image   │──▶ docker pull itzg/minecraft-server:1.21
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Update       │──▶ Update container with new image
│    container    │    Keep volume mounts (world data)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Start server │──▶ Start container, stream logs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. Health check │──▶ Wait for "Done!" in logs
└────────┬────────┘    or timeout after 5 min
         │
    ┌────┴────┐
    │         │
 Success    Failure
    │         │
    ▼         ▼
 [Done]   [Rollback]──▶ Restore backup, restart old version
```

### 10.5 Blueprint Updates (Game Templates)

```typescript
// Blueprints are stored in a Git repository
// Operators can sync from official repo or maintain their own

interface BlueprintRepository {
  // Official StellarStack blueprints
  official: "https://github.com/stellarstack/blueprints";

  // Community blueprints (optional)
  community: "https://github.com/stellarstack/community-blueprints";

  // Operator's custom blueprints
  custom: "/var/lib/stellarstack/blueprints";
}

// Blueprint sync command
// Pulls latest blueprints from repository
// POST /api/v1/admin/blueprints/sync
{
  "source": "official",  // or "community" or "custom"
  "force": false         // Overwrite local changes
}

// Blueprint structure with versions
interface Blueprint {
  id: "minecraft-paper";
  name: "Minecraft Paper";

  // Multiple versions available
  versions: [
    {
      tag: "1.21",
      dockerImage: "itzg/minecraft-server:java21",
      releaseDate: "2024-06-13",
      status: "stable",
      minDaemonVersion: "1.2.0",
    },
    {
      tag: "1.20.6",
      dockerImage: "itzg/minecraft-server:java17",
      releaseDate: "2024-04-29",
      status: "stable",
    },
    {
      tag: "1.20.4",
      dockerImage: "itzg/minecraft-server:java17",
      releaseDate: "2024-01-24",
      status: "legacy",
      deprecationNotice: "Update to 1.21 recommended",
    },
  ];

  // Version constraints
  constraints: {
    minPanelVersion: "1.0.0";
    maxPanelVersion: null;  // No upper limit
  };
}
```

### 10.6 Version Compatibility Matrix

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      VERSION COMPATIBILITY MATRIX                             │
└──────────────────────────────────────────────────────────────────────────────┘

Panel Version │ Daemon Version │ Blueprint Format │ Notes
──────────────┼────────────────┼──────────────────┼─────────────────────────
v1.0.x        │ v1.0.x         │ v1               │ Initial release
v1.1.x        │ v1.0.x - v1.1.x│ v1               │ Daemon backward compat
v1.2.x        │ v1.1.x - v1.2.x│ v1, v2           │ New blueprint format
v2.0.x        │ v2.0.x+        │ v2               │ Breaking changes

UPGRADE PATH:
─────────────
v1.0 → v1.1 → v1.2 → v2.0

Cannot skip major versions. Must upgrade sequentially.
Each upgrade runs necessary migrations automatically.

DAEMON COMPATIBILITY:
─────────────────────
- Panel can communicate with daemon ±1 minor version
- Panel v1.2 works with daemon v1.1, v1.2, v1.3
- Panel v2.0 requires daemon v2.0+
- Daemon shows warning if version mismatch detected
```

### 10.2 Daemon Update Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DAEMON UPDATE FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

Step 1: Release new daemon version
──────────────────────────────────
CI/CD ──▶ Build daemon binary (linux-amd64, linux-arm64)
      ──▶ Upload to release server
      ──▶ Create release record in database
      ──▶ Mark as "canary" (limited rollout)

Step 2: Canary deployment (10% of nodes)
────────────────────────────────────────
Update Service ──▶ Select 10% of nodes (by region, size)
               ──▶ Send update command to each
               ──▶ Monitor for errors (30 min)
               ──▶ If errors > threshold: halt and rollback

Step 3: Gradual rollout
───────────────────────
Update Service ──▶ 25% of remaining nodes
               ──▶ Monitor (15 min)
               ──▶ 50% of remaining nodes
               ──▶ Monitor (15 min)
               ──▶ 100% of remaining nodes

Step 4: Node receives update command
────────────────────────────────────
Daemon ──▶ Download new binary to temp location
       ──▶ Verify checksum
       ──▶ Gracefully stop accepting new commands
       ──▶ Wait for in-flight operations
       ──▶ Replace binary
       ──▶ Restart daemon process (systemd)
       ──▶ Report new version to control plane
```

### 10.3 Update Command Structure

```typescript
// Update command sent to daemon
interface UpdateCommand {
  type: "daemon.update";
  version: string;
  downloadUrl: string;
  checksum: {
    algorithm: "sha256";
    value: string;
  };
  rollbackVersion: string;  // Version to rollback to on failure
  deadline: number;         // Unix timestamp - update must complete by
}

// Daemon response
interface UpdateResponse {
  type: "daemon.update.result";
  nodeId: string;
  previousVersion: string;
  newVersion: string;
  status: "success" | "failed" | "rolled_back";
  error?: string;
  duration: number;  // Milliseconds
}
```

### 10.4 Rollback Mechanism

```rust
// daemon/src/updater.rs
impl Updater {
    pub async fn update(&self, command: UpdateCommand) -> Result<UpdateResponse> {
        // Store current version for rollback
        let current_version = self.current_version();
        let backup_path = format!("/var/lib/stellarstack/daemon.backup");

        // Backup current binary
        fs::copy("/usr/local/bin/stellarstack-daemon", &backup_path)?;

        // Download new version
        let new_binary = self.download(&command.download_url).await?;

        // Verify checksum
        if !self.verify_checksum(&new_binary, &command.checksum) {
            return Err(UpdateError::ChecksumMismatch);
        }

        // Write new binary
        fs::write("/usr/local/bin/stellarstack-daemon.new", &new_binary)?;
        fs::set_permissions("/usr/local/bin/stellarstack-daemon.new",
            fs::Permissions::from_mode(0o755))?;

        // Atomic replace
        fs::rename(
            "/usr/local/bin/stellarstack-daemon.new",
            "/usr/local/bin/stellarstack-daemon"
        )?;

        // Trigger restart via systemd
        // Systemd will restart the daemon with the new binary
        // The new daemon will report its version on startup

        // If this process is still alive after 30s, something went wrong
        // The watchdog will restore the backup and restart

        Ok(UpdateResponse {
            status: UpdateStatus::Success,
            previous_version: current_version,
            new_version: command.version,
        })
    }
}
```

---

## 11. Infrastructure Recommendations

> **For Operators**: This section helps you decide where to host your StellarStack panel and game server nodes. You can mix and match — run the panel on one provider and nodes on others, or even use your own hardware.

### 11.1 Recommended Providers

#### 11.1.1 VPS Providers (Game Server Nodes)

| Provider | Best For | Pricing | Pros | Cons |
|----------|----------|---------|------|------|
| **Hetzner** | EU/US nodes | €4.50/mo (2 vCPU, 4GB) | Excellent price/performance, dedicated vCPU | Limited regions |
| **OVH** | Game servers | €6/mo (2 vCPU, 4GB) | Game-optimized, anti-DDoS | Complex interface |
| **Vultr** | Global reach | $24/mo (2 vCPU, 4GB) | 25 locations, hourly billing | Higher cost |
| **DigitalOcean** | Simplicity | $24/mo (2 vCPU, 4GB) | Great API, simple | Limited game performance |
| **Linode (Akamai)** | Reliability | $24/mo (2 vCPU, 4GB) | Stable, good support | Fewer locations |
| **AWS Lightsail** | AWS ecosystem | $20/mo (2 vCPU, 4GB) | AWS integration | Complex networking |

#### 11.1.2 Control Plane Hosting

| Option | Best For | Est. Cost | Notes |
|--------|----------|-----------|-------|
| **Railway** | Quick start | $20/mo | Easy deployment, auto-scaling |
| **Render** | Simplicity | $25/mo | Managed PostgreSQL included |
| **Fly.io** | Global edge | $30/mo | Great for low-latency API |
| **Self-hosted VPS** | Control | $20/mo | Hetzner CX31 or similar |
| **Kubernetes** | Scale | $100+/mo | For large deployments |

#### 11.1.3 Managed Services

| Service | Provider Options | Est. Cost |
|---------|------------------|-----------|
| **PostgreSQL** | Neon (free tier), Supabase, Railway | $0-25/mo |
| **Redis** | Upstash (free tier), Railway, Redis Cloud | $0-25/mo |
| **Object Storage** | Cloudflare R2 (free egress), S3, Backblaze B2 | $0.01/GB |

### 11.2 Recommended Architecture by Scale

#### Small (1-10 nodes, <100 servers)

```
Control Plane: Single VPS (Hetzner CX31)
├── Next.js + Hono (Docker)
├── PostgreSQL (Docker)
├── Redis (Docker)
└── Caddy (reverse proxy)

Est. Cost: $30-50/mo
```

#### Medium (10-50 nodes, 100-1000 servers)

```
Control Plane:
├── App Server: 2x VPS behind load balancer
├── PostgreSQL: Managed (Neon/Supabase)
├── Redis: Managed (Upstash)
└── CDN: Cloudflare

Est. Cost: $100-200/mo + node costs
```

#### Large (50+ nodes, 1000+ servers)

```
Control Plane:
├── Kubernetes cluster (3+ nodes)
├── PostgreSQL: Managed with read replicas
├── Redis: Cluster mode
├── Object Storage: S3/R2 for backups
└── CDN + WAF: Cloudflare Pro

Est. Cost: $500+/mo + node costs
```

### 11.3 Network Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    NETWORK ARCHITECTURE (Operator's Setup)                    │
└──────────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────┐
                          │   Cloudflare    │  (Optional - recommended)
                          │   (CDN + WAF)   │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
           ┌───────────────┐             ┌───────────────┐
           │ panel.example │             │ *.nodes.      │
           │    .com       │             │  example.com  │
           │ (Control)     │             │ (Node proxy)  │
           └───────┬───────┘             └───────┬───────┘
                   │                             │
                   ▼                             │
           ┌───────────────┐                     │
           │    Caddy      │                     │
           │ (reverse prxy)│                     │
           └───────┬───────┘                     │
                   │                             │
        ┌──────────┴──────────┐                  │
        │                     │                  │
        ▼                     ▼                  │
   ┌─────────┐           ┌─────────┐             │
   │ App 1   │           │ App 2   │             │
   └─────────┘           └─────────┘             │
                                                 │
        ┌────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────┐
   │              Node Direct Access                  │
   │                                                  │
   │  node-us-west.stellarstack.app:5000 ──▶ Node 1  │
   │  node-us-east.stellarstack.app:5000 ──▶ Node 2  │
   │  node-eu-west.stellarstack.app:5000 ──▶ Node 3  │
   └─────────────────────────────────────────────────┘
```

### 11.4 DNS Configuration (Example)

```
# Control plane (operator's panel)
panel.example.com.              A       <PANEL_SERVER_IP>

# Nodes (operator adds DNS for each node they connect)
node-1.example.com.             A       <NODE_1_IP>
node-2.example.com.             A       <NODE_2_IP>
eu-node.example.com.            A       <NODE_3_IP>

# Alternative: Use IP addresses directly (no DNS needed for nodes)
# Nodes can be registered by IP in the panel
```

---

## 12. Scalability & High Availability

This section covers how operators can scale StellarStack from a single server to a globally distributed, highly available deployment.

### 12.1 Scalability Tiers

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          SCALABILITY TIERS                                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: Single Server (Starter)                                              │
│ Users: 1-50 | Servers: 1-100 | Nodes: 1-5                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌────────────────────────────────────────┐                               │
│    │           Single VPS                    │                               │
│    │  ┌──────────┬──────────┬────────────┐  │                               │
│    │  │ Next.js  │   Hono   │   Caddy    │  │                               │
│    │  └──────────┴──────────┴────────────┘  │                               │
│    │  ┌──────────┬──────────┐               │                               │
│    │  │ Postgres │  Redis   │               │                               │
│    │  └──────────┴──────────┘               │                               │
│    └────────────────────────────────────────┘                               │
│                                                                              │
│    Pros: Simple, cheap ($10-30/mo)                                          │
│    Cons: Single point of failure, limited scale                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: Separated Services (Growth)                                          │
│ Users: 50-500 | Servers: 100-1000 | Nodes: 5-20                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│         ┌─────────────┐                                                     │
│         │ Cloudflare  │  (CDN, DDoS, WAF)                                   │
│         └──────┬──────┘                                                     │
│                │                                                             │
│         ┌──────▼──────┐                                                     │
│         │    Caddy    │  (Load balancer)                                    │
│         └──────┬──────┘                                                     │
│                │                                                             │
│    ┌───────────┴───────────┐                                                │
│    ▼                       ▼                                                │
│ ┌──────────┐         ┌──────────┐                                           │
│ │ App VPS  │         │ App VPS  │   (Next.js + Hono)                        │
│ │    #1    │         │    #2    │                                           │
│ └────┬─────┘         └────┬─────┘                                           │
│      └──────────┬─────────┘                                                 │
│                 │                                                            │
│    ┌────────────┴────────────┐                                              │
│    ▼                         ▼                                              │
│ ┌──────────┐           ┌──────────┐                                         │
│ │ Managed  │           │ Managed  │                                         │
│ │ Postgres │           │  Redis   │                                         │
│ └──────────┘           └──────────┘                                         │
│                                                                              │
│    Pros: Redundancy, can scale web tier independently                       │
│    Cons: More complex, higher cost ($100-300/mo)                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: Geo-Distributed (Enterprise)                                         │
│ Users: 500+ | Servers: 1000+ | Nodes: 20+                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                      ┌─────────────────┐                                    │
│                      │   Cloudflare    │                                    │
│                      │  (Global CDN)   │                                    │
│                      └────────┬────────┘                                    │
│                               │                                              │
│         ┌─────────────────────┼─────────────────────┐                       │
│         │                     │                     │                       │
│         ▼                     ▼                     ▼                       │
│    ┌─────────┐          ┌─────────┐          ┌─────────┐                   │
│    │ US-WEST │          │ US-EAST │          │   EU    │                   │
│    │ Region  │          │ Region  │          │ Region  │                   │
│    └────┬────┘          └────┬────┘          └────┬────┘                   │
│         │                    │                    │                         │
│    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐                   │
│    │ Next.js │          │ Next.js │          │ Next.js │                   │
│    │ + Hono  │          │ + Hono  │          │ + Hono  │                   │
│    └────┬────┘          └────┬────┘          └────┬────┘                   │
│         │                    │                    │                         │
│         └────────────────────┼────────────────────┘                        │
│                              │                                              │
│                   ┌──────────┴──────────┐                                   │
│                   ▼                     ▼                                   │
│             ┌──────────┐         ┌──────────────┐                          │
│             │ Postgres │         │ Redis Cluster│                          │
│             │ (Primary │         │   (Global)   │                          │
│             │+ Replicas│         │              │                          │
│             └──────────┘         └──────────────┘                          │
│                                                                              │
│    Pros: Low latency globally, high availability, unlimited scale           │
│    Cons: Complex, expensive ($500+/mo), requires expertise                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Component Scalability

#### 12.2.1 Frontend (Next.js)

```typescript
// Next.js is stateless - scale horizontally easily

Scaling strategies:
├── Multiple instances behind load balancer
├── Deploy to edge (Vercel, Cloudflare Pages, Fly.io)
├── Static generation for public pages
└── CDN for static assets

// next.config.js optimizations
const nextConfig = {
  output: 'standalone',        // Smaller Docker images
  images: {
    domains: ['cdn.example.com'],
    loader: 'custom',          // Use CDN for images
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};
```

#### 12.2.2 API (Hono)

```typescript
// Hono is stateless - scale horizontally

Scaling strategies:
├── Multiple instances behind load balancer
├── Deploy to edge runtime (Cloudflare Workers, Deno Deploy)
├── Regional deployments for lower latency
└── Connection pooling for database

// Stateless design principles:
// 1. No in-memory state (use Redis)
// 2. JWT/stateless sessions
// 3. Idempotent operations
// 4. Request IDs for tracing

// Load balancer health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy', region: process.env.REGION });
});

// Regional routing header
app.use('*', async (c, next) => {
  c.header('X-Served-By', process.env.REGION || 'default');
  await next();
});
```

#### 12.2.3 Database (PostgreSQL)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    DATABASE SCALING STRATEGIES                                │
└──────────────────────────────────────────────────────────────────────────────┘

Strategy 1: Vertical Scaling (Simple)
─────────────────────────────────────
- Upgrade to larger instance
- Good for: Tier 1-2 deployments
- Limit: ~64 vCPU, 256GB RAM

Strategy 2: Read Replicas (Read-heavy workloads)
────────────────────────────────────────────────

    ┌──────────────┐
    │    Primary   │◀── Writes
    │  (us-east)   │
    └──────┬───────┘
           │ Replication
    ┌──────┴──────────────┐
    │                     │
    ▼                     ▼
┌──────────┐        ┌──────────┐
│ Replica  │        │ Replica  │◀── Reads
│(us-west) │        │  (eu)    │
└──────────┘        └──────────┘

- API routes reads to nearest replica
- All writes go to primary
- Good for: Dashboards, reporting, read-heavy APIs

Strategy 3: Connection Pooling (High concurrency)
─────────────────────────────────────────────────

    ┌────────────────┐
    │   App Server   │
    └───────┬────────┘
            │
            ▼
    ┌────────────────┐
    │   PgBouncer    │  (Connection pooler)
    │  or pgcat      │
    └───────┬────────┘
            │
            ▼
    ┌────────────────┐
    │   PostgreSQL   │
    └────────────────┘

- Reduces connection overhead
- Essential for serverless/edge deployments
- Managed options: Supabase, Neon (built-in pooling)

Strategy 4: Sharding (Massive scale - rarely needed)
────────────────────────────────────────────────────
- Shard by operator_id or region
- Complex, only for 10,000+ servers
- Consider: CockroachDB, Citus, Vitess
```

#### 12.2.4 Redis

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      REDIS SCALING STRATEGIES                                 │
└──────────────────────────────────────────────────────────────────────────────┘

Strategy 1: Single Instance (Tier 1)
────────────────────────────────────
- Simple, low latency
- Risk: Single point of failure
- Good for: <1000 concurrent connections

Strategy 2: Sentinel (High Availability)
────────────────────────────────────────

    ┌──────────────────────────────────────┐
    │           Redis Sentinel             │
    │  (monitors and handles failover)     │
    └──────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
    ┌───────┐    ┌───────┐    ┌───────┐
    │Primary│───▶│Replica│    │Replica│
    └───────┘    └───────┘    └───────┘

- Automatic failover
- Good for: Production deployments

Strategy 3: Cluster (Horizontal Scale)
──────────────────────────────────────

    ┌─────────────────────────────────────────────────┐
    │                Redis Cluster                     │
    │                                                  │
    │   ┌─────────┐  ┌─────────┐  ┌─────────┐        │
    │   │ Shard 1 │  │ Shard 2 │  │ Shard 3 │        │
    │   │ Primary │  │ Primary │  │ Primary │        │
    │   │+Replica │  │+Replica │  │+Replica │        │
    │   └─────────┘  └─────────┘  └─────────┘        │
    │                                                  │
    │   Slots: 0-5460  5461-10922  10923-16383       │
    └─────────────────────────────────────────────────┘

- Data sharded across nodes
- Good for: Very high throughput, large datasets
- Managed options: AWS ElastiCache, Upstash, Redis Cloud

Strategy 4: Global Distribution
───────────────────────────────

    ┌─────────────────────────────────────────────────┐
    │              Upstash Global Redis               │
    │                                                  │
    │   US-WEST ◀──────▶ US-EAST ◀──────▶ EU         │
    │   (replica)        (primary)        (replica)   │
    │                                                  │
    │   Reads: Local replica (low latency)            │
    │   Writes: Forwarded to primary                  │
    └─────────────────────────────────────────────────┘

- Best for: Geo-distributed deployments
- Managed only: Upstash, Redis Cloud Active-Active
```

### 12.3 Load Balancing Strategies

#### 12.3.1 Layer 7 Load Balancing (Recommended)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 7 LOAD BALANCING                                     │
└──────────────────────────────────────────────────────────────────────────────┘

Option 1: Cloudflare (Recommended for most)
───────────────────────────────────────────
- Free tier available
- Global anycast CDN
- DDoS protection included
- Load balancing ($5/mo extra)
- Health checks
- Geo routing

Option 2: Caddy (Self-hosted)
─────────────────────────────
- Automatic HTTPS
- Simple config
- Good for Tier 1-2

# Caddyfile
panel.example.com {
    reverse_proxy app1:3000 app2:3000 {
        lb_policy round_robin
        health_uri /health
        health_interval 10s
    }
}

Option 3: Nginx (Self-hosted, more control)
───────────────────────────────────────────
# nginx.conf
upstream api_servers {
    least_conn;  # Send to least busy server
    server app1:3000 weight=5;
    server app2:3000 weight=5;
    server app3:3000 backup;  # Only if others fail

    keepalive 32;  # Connection pooling
}

server {
    location / {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    location /health {
        access_log off;
        return 200 "healthy";
    }
}

Option 4: Traefik (Container-native)
────────────────────────────────────
- Auto-discovery via Docker labels
- Built-in Let's Encrypt
- Good for Kubernetes

# docker-compose.yml
labels:
  - "traefik.http.routers.api.rule=Host(`api.example.com`)"
  - "traefik.http.services.api.loadbalancer.server.port=3000"
  - "traefik.http.services.api.loadbalancer.healthcheck.path=/health"
```

#### 12.3.2 Geo-Based Routing

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       GEO-BASED ROUTING                                       │
└──────────────────────────────────────────────────────────────────────────────┘

                         User Request
                              │
                              ▼
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (Geo Router)  │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
     US Users           EU Users          APAC Users
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  US Region  │   │  EU Region  │   │ APAC Region │
    │             │   │             │   │             │
    │ ┌─────────┐ │   │ ┌─────────┐ │   │ ┌─────────┐ │
    │ │ Next.js │ │   │ │ Next.js │ │   │ │ Next.js │ │
    │ │ + Hono  │ │   │ │ + Hono  │ │   │ │ + Hono  │ │
    │ └─────────┘ │   │ └─────────┘ │   │ └─────────┘ │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Primary Database│
                    │   (US-EAST)     │
                    └─────────────────┘

Implementation options:
1. Cloudflare Load Balancing (Geo Steering)
2. AWS Route 53 (Geolocation routing)
3. Cloudflare Workers (custom logic)

// Cloudflare Worker example
export default {
  async fetch(request) {
    const country = request.cf?.country || 'US';

    const regionMap = {
      'US': 'https://us.api.example.com',
      'CA': 'https://us.api.example.com',
      'GB': 'https://eu.api.example.com',
      'DE': 'https://eu.api.example.com',
      'FR': 'https://eu.api.example.com',
      // ... more mappings
    };

    const origin = regionMap[country] || 'https://us.api.example.com';
    return fetch(origin + new URL(request.url).pathname, request);
  }
}
```

### 12.4 High Availability Patterns

#### 12.4.1 Health Checks & Failover

```typescript
// Health check endpoint with dependency checks
app.get('/health', async (c) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    daemon_connectivity: await checkDaemonConnectivity(),
  };

  const healthy = Object.values(checks).every(c => c.status === 'healthy');

  return c.json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    region: process.env.REGION,
    version: process.env.APP_VERSION,
    timestamp: new Date().toISOString(),
  }, healthy ? 200 : 503);
});

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latency: Date.now() - start };
  } catch (e) {
    return { status: 'unhealthy', error: e.message };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  try {
    const start = Date.now();
    await redis.ping();
    return { status: 'healthy', latency: Date.now() - start };
  } catch (e) {
    return { status: 'unhealthy', error: e.message };
  }
}
```

#### 12.4.2 Circuit Breaker Pattern

```typescript
// Prevent cascading failures when a service is down
import CircuitBreaker from 'opossum';

const daemonBreaker = new CircuitBreaker(callDaemon, {
  timeout: 5000,           // Timeout after 5s
  errorThresholdPercentage: 50,  // Open circuit if 50% fail
  resetTimeout: 30000,     // Try again after 30s
});

daemonBreaker.on('open', () => {
  logger.warn('Circuit breaker opened - daemon communication failing');
  alertOps('Daemon circuit breaker opened');
});

daemonBreaker.on('halfOpen', () => {
  logger.info('Circuit breaker half-open - testing daemon');
});

daemonBreaker.on('close', () => {
  logger.info('Circuit breaker closed - daemon recovered');
});

// Usage
async function sendCommandToDaemon(nodeId: string, command: Command) {
  return daemonBreaker.fire(nodeId, command);
}
```

#### 12.4.3 Graceful Degradation

```typescript
// Serve cached data when primary systems are unavailable
async function getServerStatus(serverId: string) {
  // Try 1: Real-time from Redis
  try {
    const cached = await redis.get(`server:${serverId}:status`);
    if (cached) return { data: JSON.parse(cached), source: 'realtime' };
  } catch (e) {
    logger.warn('Redis unavailable, falling back');
  }

  // Try 2: Database (might be stale)
  try {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { status: true, updatedAt: true },
    });
    if (server) {
      return {
        data: server,
        source: 'database',
        stale: Date.now() - server.updatedAt.getTime() > 60000,
      };
    }
  } catch (e) {
    logger.error('Database unavailable');
  }

  // Try 3: Return unknown status
  return {
    data: { status: 'unknown' },
    source: 'fallback',
    error: 'Unable to fetch server status',
  };
}
```

### 12.5 Deployment Architectures

#### 12.5.1 Docker Compose (Tier 1)

```yaml
# docker-compose.yml - Single server deployment
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - web
      - api

  web:
    build: ./apps/web
    environment:
      - API_URL=http://api:4000
    restart: unless-stopped

  api:
    build: ./apps/api
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/stellarstack
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=stellarstack
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  caddy_data:
  postgres_data:
  redis_data:
```

#### 12.5.2 Docker Swarm (Tier 2)

```yaml
# docker-stack.yml - Multi-server deployment
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    deploy:
      mode: global  # Run on every node
      placement:
        constraints:
          - node.role == manager

  web:
    image: registry.example.com/stellarstack-web:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      rollback_config:
        parallelism: 1
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  api:
    image: registry.example.com/stellarstack-api:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Use managed database and Redis for Tier 2+
```

#### 12.5.3 Kubernetes (Tier 3)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stellarstack-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: stellarstack-api
  template:
    metadata:
      labels:
        app: stellarstack-api
    spec:
      containers:
        - name: api
          image: stellarstack/api:latest
          ports:
            - containerPort: 4000
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: stellarstack-secrets
                  key: database-url
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: stellarstack-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: stellarstack-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### 12.6 Scaling Checklist

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       SCALING READINESS CHECKLIST                             │
└──────────────────────────────────────────────────────────────────────────────┘

□ Application Layer
  □ Frontend is stateless (no server-side sessions)
  □ API is stateless (JWT/Redis sessions)
  □ Health check endpoints implemented
  □ Graceful shutdown handling
  □ Environment-based configuration

□ Database
  □ Connection pooling configured
  □ Indexes optimized for common queries
  □ Read replicas configured (if needed)
  □ Automated backups enabled
  □ Point-in-time recovery available

□ Caching
  □ Redis high availability (Sentinel/Cluster)
  □ Cache invalidation strategy defined
  □ TTLs set appropriately
  □ Memory limits configured

□ Load Balancing
  □ Health checks configured
  □ SSL termination at edge
  □ Sticky sessions disabled (stateless)
  □ Connection draining on deploys

□ Monitoring
  □ Application metrics (latency, errors, throughput)
  □ Infrastructure metrics (CPU, memory, disk)
  □ Database metrics (connections, query time)
  □ Alerting configured
  □ Log aggregation setup

□ Deployment
  □ Zero-downtime deployments
  □ Rollback procedure documented
  □ Database migrations are backwards compatible
  □ Feature flags for gradual rollouts
```

---

## 13. Security Considerations

### 12.1 Security Layers

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                     │
└──────────────────────────────────────────────────────────────────────────────┘

Layer 1: Edge (Cloudflare)
├── DDoS protection
├── WAF rules
├── Rate limiting
├── Bot protection
└── SSL termination

Layer 2: Application
├── Authentication (Better Auth)
├── Authorization (RBAC)
├── Input validation
├── CSRF protection
└── Security headers

Layer 3: Infrastructure
├── Network segmentation
├── Firewall rules
├── mTLS between services
├── Encrypted storage
└── Audit logging

Layer 4: Container
├── Resource limits
├── Read-only filesystems (where possible)
├── No privileged containers
├── Network isolation
└── Seccomp profiles
```

### 12.2 Firewall Rules

```bash
# Control Plane
ufw default deny incoming
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH (restrict to admin IPs)

# Game Server Node
ufw default deny incoming
ufw allow 5000/tcp              # Daemon WebSocket
ufw allow 22/tcp                # SSH (restrict to control plane)
ufw allow 25565:25665/tcp       # Minecraft ports (example range)
ufw allow 25565:25665/udp       # Minecraft ports (example range)
ufw allow 27015:27115/tcp       # Source games
ufw allow 27015:27115/udp       # Source games
```

### 12.3 Secrets Management

```typescript
// Environment variables (minimum)
POSTGRES_URL=           // Database connection
REDIS_URL=              // Redis connection
BETTER_AUTH_SECRET=     // Session encryption
JWT_SECRET=             // Console token signing
DAEMON_SIGNING_KEY=     // Daemon communication

// Recommended: Use a secrets manager
// - HashiCorp Vault
// - AWS Secrets Manager
// - Doppler
// - Infisical
```

### 12.4 Audit Logging

```typescript
// All sensitive actions are logged
interface AuditLog {
  id: string;
  timestamp: Date;

  // Actor
  actorType: "user" | "daemon" | "system" | "api_key";
  actorId: string;
  actorIp?: string;

  // Action
  action: string;
  resource: string;
  resourceId: string;

  // Details
  details: Record<string, any>;

  // Result
  status: "success" | "failure";
  error?: string;
}

// Example actions logged:
// - user.login, user.logout
// - server.create, server.delete
// - server.start, server.stop
// - console.connect, console.command
// - node.register, node.remove
// - permission.grant, permission.revoke
// - settings.update
```

---

## 13. Database Schema

### 13.1 Core Tables

```prisma
// prisma/schema.prisma

// ============================================
// Better Auth tables (managed by Better Auth)
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  sessions      Session[]
  accounts      Account[]
  servers       Server[]
  subusers      Subuser[]
  apiKeys       ApiKey[]
  auditLogs     AuditLog[]

  // Custom fields
  role          Role      @default(USER)
  suspended     Boolean   @default(false)
  suspendedAt   DateTime?
  suspendReason String?
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  expiresAt    DateTime
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                String   @id @default(cuid())
  userId            String
  provider          String
  providerAccountId String
  refreshToken      String?
  accessToken       String?
  expiresAt         DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

// ============================================
// StellarStack tables
// ============================================

model Node {
  id            String     @id @default(cuid())
  name          String
  hostname      String
  port          Int        @default(5000)

  // Location
  region        String
  location      String?

  // Specs
  cpuCores      Int
  memoryMb      Int
  diskMb        Int

  // Status
  status        NodeStatus @default(OFFLINE)
  lastHeartbeat DateTime?

  // Auto-scaling
  providerId    String?    // External provider ID
  providerType  String?    // hetzner, vultr, etc.
  autoScaled    Boolean    @default(false)

  // Security
  apiToken      String     @unique

  // Timestamps
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // Relations
  servers       Server[]
  allocations   Allocation[]
}

model Server {
  id            String       @id @default(cuid())

  // Owner
  userId        String
  user          User         @relation(fields: [userId], references: [id])

  // Node
  nodeId        String
  node          Node         @relation(fields: [nodeId], references: [id])

  // Container
  containerId   String?
  containerName String

  // Blueprint
  blueprintId   String
  blueprint     Blueprint    @relation(fields: [blueprintId], references: [id])

  // Configuration
  name          String
  description   String?

  // Resources
  memoryMb      Int
  cpuShares     Int
  diskMb        Int

  // Status
  status        ServerStatus @default(OFFLINE)
  installedAt   DateTime?

  // Timestamps
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  // Relations
  allocations   Allocation[]
  subusers      Subuser[]
  backups       Backup[]
  schedules     Schedule[]
  variables     ServerVariable[]
}

model Allocation {
  id          String   @id @default(cuid())

  nodeId      String
  node        Node     @relation(fields: [nodeId], references: [id])

  serverId    String?
  server      Server?  @relation(fields: [serverId], references: [id])

  ip          String
  port        Int
  protocol    Protocol @default(TCP)
  isPrimary   Boolean  @default(false)

  createdAt   DateTime @default(now())

  @@unique([nodeId, ip, port, protocol])
}

model Blueprint {
  id          String   @id @default(cuid())

  slug        String   @unique
  name        String
  description String
  category    String
  icon        String?

  // Docker
  dockerImage String

  // Defaults
  defaultMemory   Int
  defaultCpu      Int
  defaultDisk     Int

  // Configuration
  configSchema    Json     // JSON Schema for variables

  // Versions
  versions        BlueprintVersion[]

  // Relations
  servers         Server[]

  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model BlueprintVersion {
  id          String    @id @default(cuid())

  blueprintId String
  blueprint   Blueprint @relation(fields: [blueprintId], references: [id])

  tag         String
  name        String
  recommended Boolean   @default(false)

  createdAt   DateTime  @default(now())

  @@unique([blueprintId, tag])
}

model Subuser {
  id          String   @id @default(cuid())

  userId      String
  user        User     @relation(fields: [userId], references: [id])

  serverId    String
  server      Server   @relation(fields: [serverId], references: [id])

  permissions String[] // Array of permission strings

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, serverId])
}

model ServerVariable {
  id          String   @id @default(cuid())

  serverId    String
  server      Server   @relation(fields: [serverId], references: [id])

  key         String
  value       String

  @@unique([serverId, key])
}

model Backup {
  id          String       @id @default(cuid())

  serverId    String
  server      Server       @relation(fields: [serverId], references: [id])

  name        String
  sizeMb      Int?
  checksum    String?

  status      BackupStatus @default(PENDING)

  storageUrl  String?

  createdAt   DateTime     @default(now())
  completedAt DateTime?
}

model Schedule {
  id          String   @id @default(cuid())

  serverId    String
  server      Server   @relation(fields: [serverId], references: [id])

  name        String
  cron        String   // Cron expression
  action      String   // start, stop, restart, backup, command
  payload     Json?    // Action-specific data

  enabled     Boolean  @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ApiKey {
  id          String    @id @default(cuid())

  userId      String
  user        User      @relation(fields: [userId], references: [id])

  name        String
  keyHash     String    @unique // Store hashed, not plaintext

  permissions String[]

  lastUsedAt  DateTime?
  expiresAt   DateTime?

  createdAt   DateTime  @default(now())
}

model AuditLog {
  id          String   @id @default(cuid())

  userId      String?
  user        User?    @relation(fields: [userId], references: [id])

  actorType   String   // user, daemon, system, api_key
  actorId     String
  actorIp     String?

  action      String
  resource    String
  resourceId  String?

  details     Json?

  status      String   // success, failure
  error       String?

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([resource, resourceId])
  @@index([createdAt])
}

// ============================================
// Enums
// ============================================

enum Role {
  USER
  MODERATOR
  ADMIN
  SUPER_ADMIN
}

enum NodeStatus {
  OFFLINE
  STARTING
  ONLINE
  UNHEALTHY
  DRAINING
  MAINTENANCE
}

enum ServerStatus {
  OFFLINE
  STARTING
  RUNNING
  STOPPING
  CRASHED
  INSTALLING
  REINSTALLING
  SUSPENDED
}

enum Protocol {
  TCP
  UDP
}

enum BackupStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

---

## 14. API Design

### 14.1 API Standards

- **Base URL**: `https://api.stellarstack.app/v1`
- **Authentication**: Cookie-based sessions (Better Auth) or API keys
- **Content-Type**: `application/json`
- **Error Format**: RFC 7807 Problem Details

### 14.2 Response Format

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

// Error response (RFC 7807)
interface ErrorResponse {
  success: false;
  error: {
    type: string;      // Error type URI
    title: string;     // Short description
    status: number;    // HTTP status code
    detail?: string;   // Detailed message
    instance?: string; // Request ID
    errors?: {         // Validation errors
      field: string;
      message: string;
    }[];
  };
}
```

### 14.3 API Endpoints Reference

```yaml
# Complete API reference

# Authentication (Better Auth)
POST   /auth/sign-in              # Sign in with email/password
POST   /auth/sign-up              # Register new account
POST   /auth/sign-out             # Sign out
GET    /auth/session              # Get current session
POST   /auth/forgot-password      # Request password reset
POST   /auth/reset-password       # Reset password
POST   /auth/verify-email         # Verify email address
GET    /auth/oauth/{provider}     # OAuth sign in

# Users
GET    /users/me                  # Get current user
PATCH  /users/me                  # Update current user
GET    /users/me/servers          # List user's servers
GET    /users/me/api-keys         # List API keys
POST   /users/me/api-keys         # Create API key
DELETE /users/me/api-keys/:id     # Delete API key

# Servers
GET    /servers                   # List servers
POST   /servers                   # Create server
GET    /servers/:id               # Get server
PATCH  /servers/:id               # Update server
DELETE /servers/:id               # Delete server

# Server actions
POST   /servers/:id/start         # Start server
POST   /servers/:id/stop          # Stop server
POST   /servers/:id/restart       # Restart server
POST   /servers/:id/kill          # Force kill server
POST   /servers/:id/reinstall     # Reinstall server

# Server console
GET    /servers/:id/console-token # Get console access token

# Server files
GET    /servers/:id/files         # List files
GET    /servers/:id/files/content # Get file content
POST   /servers/:id/files/content # Write file content
DELETE /servers/:id/files         # Delete file/directory
POST   /servers/:id/files/rename  # Rename file
POST   /servers/:id/files/copy    # Copy file
POST   /servers/:id/files/compress # Compress files
POST   /servers/:id/files/decompress # Decompress archive

# Server backups
GET    /servers/:id/backups       # List backups
POST   /servers/:id/backups       # Create backup
GET    /servers/:id/backups/:bid  # Get backup
DELETE /servers/:id/backups/:bid  # Delete backup
POST   /servers/:id/backups/:bid/restore # Restore backup

# Server schedules
GET    /servers/:id/schedules     # List schedules
POST   /servers/:id/schedules     # Create schedule
GET    /servers/:id/schedules/:sid # Get schedule
PATCH  /servers/:id/schedules/:sid # Update schedule
DELETE /servers/:id/schedules/:sid # Delete schedule

# Server subusers
GET    /servers/:id/subusers      # List subusers
POST   /servers/:id/subusers      # Add subuser
GET    /servers/:id/subusers/:uid # Get subuser
PATCH  /servers/:id/subusers/:uid # Update subuser permissions
DELETE /servers/:id/subusers/:uid # Remove subuser

# Nodes (admin)
GET    /nodes                     # List nodes
POST   /nodes                     # Register node
GET    /nodes/:id                 # Get node
PATCH  /nodes/:id                 # Update node
DELETE /nodes/:id                 # Remove node
GET    /nodes/:id/servers         # List servers on node
GET    /nodes/:id/allocations     # List allocations on node

# Blueprints
GET    /blueprints                # List blueprints
GET    /blueprints/:id            # Get blueprint
GET    /blueprints/:id/versions   # List versions

# Admin
GET    /admin/stats               # Platform statistics
GET    /admin/users               # List all users
GET    /admin/users/:id           # Get user
PATCH  /admin/users/:id           # Update user
POST   /admin/users/:id/suspend   # Suspend user
POST   /admin/users/:id/unsuspend # Unsuspend user
POST   /admin/nodes/token         # Generate node registration token

# Events
GET    /events/stream             # SSE event stream
```

---

## 15. Failure Modes & Recovery

### 15.1 Failure Scenarios

| Scenario | Detection | Impact | Recovery |
|----------|-----------|--------|----------|
| **Control plane down** | External monitoring | No new deployments, no dashboard | Auto-restart, failover to replica |
| **Database down** | Connection failures | Complete outage | Failover to replica, restore from backup |
| **Redis down** | Connection failures | No real-time updates, no commands | Reconnect, commands queued locally |
| **Node offline** | Missed heartbeats | Servers on node unreachable | Mark unhealthy, alert admin |
| **Daemon crash** | Process exit | Node operations fail | Systemd auto-restart |
| **Container crash** | Docker events | Individual server down | Crash loop detection, alert user |

### 15.2 Health Checks

```typescript
// Control plane health endpoint
GET /health
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 2 },
    "nodes": {
      "total": 10,
      "healthy": 9,
      "unhealthy": 1,
      "offline": 0
    }
  },
  "timestamp": "2024-12-09T12:00:00Z"
}
```

### 15.3 Graceful Degradation

```typescript
// API handles service failures gracefully
async function getServerWithFallback(serverId: string) {
  try {
    // Try to get real-time status from Redis
    const cached = await redis.get(`cache:server:${serverId}:status`);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // Redis unavailable, fall back to database
    console.warn("Redis unavailable, using database");
  }

  // Database is source of truth
  return db.server.findUnique({ where: { id: serverId } });
}
```

### 15.4 Backup & Recovery

```yaml
# Backup schedule
Daily:
  - PostgreSQL: Full backup at 03:00 UTC
  - Redis: RDB snapshot at 03:30 UTC

Continuous:
  - PostgreSQL: WAL archiving (point-in-time recovery)
  - Server files: User-triggered backups to object storage

Retention:
  - Daily backups: 7 days
  - Weekly backups: 4 weeks
  - Monthly backups: 12 months
  - User server backups: Configurable (default: 5)
```

---

## Appendix A: Environment Variables

```bash
# Control Plane
DATABASE_URL="postgresql://user:pass@localhost:5432/stellarstack"
REDIS_URL="redis://localhost:6379"
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="https://stellarstack.app"
JWT_SECRET="your-jwt-secret"

# OAuth (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""

# Cloud providers (optional)
HETZNER_API_TOKEN=""
VULTR_API_KEY=""
DIGITALOCEAN_TOKEN=""

# Object storage (for backups)
S3_ENDPOINT=""
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
S3_BUCKET=""

# Monitoring (optional)
SENTRY_DSN=""

# Daemon
NODE_ID="node_xxxxx"
NODE_API_TOKEN="strk_node_xxxxx"
CONTROL_PLANE_URL="https://api.stellarstack.app"
REDIS_URL="redis://user:pass@redis.stellarstack.app:6379"
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Control Plane** | Central infrastructure running API, frontend, and databases |
| **Node** | A server running the StellarStack daemon and hosting game servers |
| **Daemon** | Rust agent running on each node, managing containers |
| **Blueprint** | Pre-configured template for deploying a specific game server |
| **Allocation** | An IP:port combination assigned to a server |
| **Subuser** | A user with limited permissions on someone else's server |

---

## Appendix C: References

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Hono Documentation](https://hono.dev)
- [Docker Engine API](https://docs.docker.com/engine/api/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Prisma Documentation](https://www.prisma.io/docs)

---

*This document is a living specification and will be updated as the architecture evolves.*
