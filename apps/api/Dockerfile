# Multi-stage build for the StellarStack API.
#
# Stage 1 — pnpm install + build the monorepo so we get a self-contained
# `apps/api/dist/main.js` plus the workspace packages it depends on.
# Stage 2 — slim runtime: copy the deployed app + its prod node_modules.
#
# Build:
#   docker build -f apps/api/Dockerfile -t ghcr.io/stellarstackoss/api:latest .
#
# This expects the repo root as the build context (so pnpm can see all
# workspace packages). The release workflow handles that.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Copy the workspace manifest + lockfile first so we can leverage
# Docker's layer cache for dependency installs.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Now copy sources for the api + the workspace packages it imports.
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared

# Generate the shared error-codes file + build the api.
RUN pnpm --filter @workspace/shared codegen:errors \
 && pnpm --filter api build

# Use pnpm deploy to flatten just the API + its prod deps into /out so
# the runtime image stays small.
RUN pnpm --filter api deploy --prod --no-optional /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r packages/db/drizzle /out/drizzle

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime

# tini reaps zombie processes from the install runner's child containers.
RUN apk add --no-cache tini

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /out ./

# Tiny migration entry point. Compiled drizzle-kit isn't bundled into the
# api binary, so the migrator runs via the JS wrapper that imports
# @workspace/db's migrator (which uses postgres-js + drizzle-kit
# programmatic migrate). The installer calls
# `docker compose run --rm api node scripts/migrate.js`.
COPY apps/api/scripts/migrate.js ./scripts/migrate.js

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
