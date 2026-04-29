ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.9

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm fetch

FROM fetch AS source
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --offline

FROM source AS build
RUN pnpm --filter worker build

FROM source AS deploy
RUN pnpm --filter worker deploy --prod /out

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deploy /out/node_modules ./node_modules
COPY --from=build /repo/apps/worker/dist ./dist
COPY --from=build /repo/apps/worker/package.json ./package.json
USER node
CMD ["node", "dist/main.js"]
