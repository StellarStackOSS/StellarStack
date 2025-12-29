# StellarStack

> **A modern, open-source game server management panel**

StellarStack is a powerful game server hosting panel built with modern technologies. It provides a comprehensive solution for managing game servers, with features like real-time monitoring, automated backups, user permissions, and more.

---

## ⚠️ Alpha Software Warning

**StellarStack is currently in ALPHA and should NOT be used in production environments.**

- Expect breaking changes between versions
- Security vulnerabilities may exist
- Features may be incomplete or unstable
- Data loss is possible

This software is under active development. Use at your own risk.

---

## Features

### Server Management
- **Multi-server Support** - Manage multiple game servers from a single panel
- **Real-time Console** - Live console output with command execution
- **Server Controls** - Start, stop, restart, and kill servers
- **Resource Monitoring** - CPU, memory, disk, and network usage stats
- **File Manager** - Browse, edit, upload, and download server files
- **SFTP Access** - Secure file transfer for server files

### Automation & Backups
- **Automated Backups** - Scheduled backups with retention policies
- **Backup Restoration** - One-click backup restore
- **Task Scheduling** - Schedule commands and power actions
- **Webhooks** - Trigger external services on events

### User Management
- **Permission System** - Granular permission nodes (45+ permissions)
- **Server Subusers** - Invite users with custom permissions
- **Two-Factor Auth** - TOTP-based 2FA support
- **Passkey Support** - WebAuthn/passkey authentication
- **OAuth Integration** - Google, GitHub, Discord login

### Administration
- **Node Management** - Manage multiple daemon nodes
- **Location Grouping** - Organize nodes by geographic location
- **Blueprint System** - Pre-configured server templates
- **Network Allocations** - IP and port allocation management
- **White-label Branding** - Custom app name, logo, colors, and CSS
- **Cloudflare Integration** - DNS management for subdomains

### Security
- **bcrypt Password Hashing** - Industry-standard password security
- **AES-256-CBC Encryption** - Secure sensitive data storage
- **Rate Limiting** - Protection against brute-force attacks
- **CSRF Protection** - Cross-site request forgery prevention
- **Security Headers** - X-Frame-Options, CSP, and more

---

## Tech Stack

### Frontend
- [Next.js 15](https://nextjs.org/) - React framework with App Router
- [React 19](https://react.dev/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [TanStack Query](https://tanstack.com/query) - Data fetching & caching
- [Lucide Icons](https://lucide.dev/) - Icon library

### Backend
- [Hono](https://hono.dev/) - Lightweight web framework
- [Better Auth](https://better-auth.com/) - Authentication library
- [Prisma](https://prisma.io/) - Database ORM
- [PostgreSQL](https://postgresql.org/) - Primary database
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) - Real-time communication

### Daemon
- [Rust](https://rust-lang.org/) - Systems programming language
- [Docker](https://docker.com/) - Container runtime
- [Tokio](https://tokio.rs/) - Async runtime

### Infrastructure
- [pnpm](https://pnpm.io/) - Package manager
- [Turborepo](https://turbo.build/) - Monorepo build system
- [Docker Compose](https://docs.docker.com/compose/) - Development environment

---

## Project Structure

```
stack/
├── apps/
│   ├── api/          # Backend API (Hono + Prisma)
│   ├── web/          # Frontend (Next.js)
│   └── docs/         # Documentation site
├── packages/
│   └── ui/           # Shared UI components
├── daemon/           # Rust daemon (separate repo)
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+
- Docker (for daemon)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/stellarstack.git
cd stellarstack/stack
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

4. Configure your `.env` files with:
```env
# API
DATABASE_URL="postgresql://user:pass@localhost:5432/stellarstack"
BETTER_AUTH_SECRET="your-secret-key"
FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:3001"

# Production required
DOWNLOAD_TOKEN_SECRET="your-download-secret"
ENCRYPTION_KEY="your-32-byte-hex-key"
```

5. Set up the database:
```bash
cd apps/api
pnpm db:push
pnpm db:generate
```

6. Start development servers:
```bash
# From root directory
pnpm dev
```

---

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret for session signing |

### Production Required
| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` | Frontend URL (not localhost) |
| `API_URL` | API URL (not localhost) |
| `DOWNLOAD_TOKEN_SECRET` | Secret for download tokens |
| `ENCRYPTION_KEY` | 32-byte hex key for AES encryption |

### Optional
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID |
| `SMTP_HOST` | SMTP server host |
| `RESEND_API_KEY` | Resend email API key |

---

## Sponsors

StellarStack is an open-source project. If you'd like to support development:

- [GitHub Sponsors](https://github.com/sponsors/your-username)
- [Open Collective](https://opencollective.com/stellarstack)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

**Made with ❤️ by the StellarStack team**
