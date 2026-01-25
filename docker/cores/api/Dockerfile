# syntax=docker/dockerfile:1.7

# --- Base
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    TURBO_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && pnpm add -g turbo

WORKDIR /repo

# --- Prune
FROM base AS pruner

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages/

RUN turbo prune --scope=@workspace/api --docker \
 && sed -i '/^settings:/a \  injectWorkspacePackages: true' ./out/pnpm-lock.yaml

# --- Install + Build
FROM base AS builder
WORKDIR /app

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    TURBO_TELEMETRY_DISABLED=1

# Copy only package files first for better layer caching
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /repo/out/json/ ./

# Install dependencies (this layer is cached if lock file hasn't changed)
RUN pnpm install --frozen-lockfile

# Copy the full source code
COPY --from=pruner /repo/out/full/ ./

# Generate Prisma client and build with Turbo (leverages turbo cache from build-packages job)
RUN pnpm --filter=@workspace/api exec prisma generate \
 && pnpm turbo run build --filter=@workspace/api

# --- Runtime
FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    TURBO_TELEMETRY_DISABLED=1

WORKDIR /app/apps/api

RUN apk add --no-cache libc6-compat \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001

# Copy the entire workspace as-is from builder
COPY --from=builder --chown=nodejs:nodejs /app /app

WORKDIR /app/apps/api

USER nodejs

EXPOSE 3001
# Run source with node --import tsx which handles ESM and TypeScript
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
