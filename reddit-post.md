# I built an open-source game server panel to get better at full-stack dev

Been working on this project called **StellarStack** for a while now. It's basically a game server management panel, similar to Pterodactyl but built with a modern stack. MIT licensed, still in alpha.

I mainly started this to challenge myself. I wanted to work on something that wasn't just another todo app — something that actually forced me to deal with real-time stuff, containers, auth, permissions, all of it. Game server management ended up being perfect for that since it touches a bit of everything.

**The stack:**

- Frontend is Next.js 15 + React 19, Tailwind, shadcn/ui, Framer Motion
- API is Hono with PostgreSQL/Prisma, Better Auth for OAuth and 2FA
- The daemon that manages servers on host machines is written in Rust (Axum + Bollard for Docker)
- Also built a desktop app with Tauri v2 that bundles the whole thing into one installable package

It's a monorepo managed with Turborepo and pnpm. The whole codebase is strict TypeScript.

Right now it handles server management, real-time console, file management, backups, multi-node support, subusers with granular permissions, a plugin system, and more. Still a lot to do but the foundation is there.

If anyone wants to check it out or has feedback, I'm all ears.
