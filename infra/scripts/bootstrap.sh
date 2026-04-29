#!/usr/bin/env bash
# Boot a fresh local development environment:
#  1. Copy .env.example → .env if missing
#  2. Bring up the compose stack
#  3. Wait for postgres + redis to be healthy
#  4. Push the Drizzle schema
#  5. Run the seed script (admin user, sample blueprint)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_DIR="${REPO_ROOT}/infra/docker"

if [[ ! -f "${DOCKER_DIR}/.env" ]]; then
  cp "${DOCKER_DIR}/.env.example" "${DOCKER_DIR}/.env"
  echo "Wrote ${DOCKER_DIR}/.env (from .env.example)"
fi

docker compose -f "${DOCKER_DIR}/compose.yaml" --env-file "${DOCKER_DIR}/.env" up -d

echo "Waiting for postgres..."
until docker compose -f "${DOCKER_DIR}/compose.yaml" --env-file "${DOCKER_DIR}/.env" exec -T postgres pg_isready -U stellar -d stellarstack >/dev/null 2>&1; do
  sleep 1
done

echo "Waiting for redis..."
until docker compose -f "${DOCKER_DIR}/compose.yaml" --env-file "${DOCKER_DIR}/.env" exec -T redis redis-cli ping >/dev/null 2>&1; do
  sleep 1
done

echo "Infrastructure ready."
echo "Next: pnpm db:push && pnpm --filter @workspace/db tsx ../../infra/scripts/seed.ts"
