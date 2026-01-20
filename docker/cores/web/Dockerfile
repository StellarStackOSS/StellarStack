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
COPY apps/web/package.json ./apps/web/
COPY packages ./packages/

RUN turbo prune --scope=web --docker \
 && sed -i '/^settings:/a \  injectWorkspacePackages: true' ./out/pnpm-lock.yaml

# --- Install + Build
FROM base AS builder
WORKDIR /app

# Build arguments for Next.js
ARG NEXT_PUBLIC_GIT_COMMIT_HASH=unknown

# Set build-time environment variables
# Note: NEXT_PUBLIC_API_URL is NOT set here - it's resolved at runtime via next-public-env
ENV NEXT_PUBLIC_GIT_COMMIT_HASH=$NEXT_PUBLIC_GIT_COMMIT_HASH \
    TURBO_TELEMETRY_DISABLED=1

# Copy only package files first for better layer caching
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /repo/out/json/ ./

# Install dependencies (this layer is cached if lock file hasn't changed)
RUN pnpm install --frozen-lockfile

# Copy the full source code
COPY --from=pruner /repo/out/full/ ./

# Build with Turbo (leverages turbo cache from build-packages job)
RUN pnpm turbo run build --filter=web

# --- Runtime
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=::
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web

RUN apk add --no-cache libc6-compat \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001

# Copy the entire workspace as-is from builder
COPY --from=builder --chown=nodejs:nodejs /app /app

WORKDIR /app/apps/web

USER nodejs

EXPOSE 3000

# Start Next.js production server
CMD ["node_modules/.bin/next", "start"]
