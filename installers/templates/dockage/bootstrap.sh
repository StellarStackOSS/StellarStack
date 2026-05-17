#!/bin/sh
# StellarStack bootstrap — runs once on first compose-up.
#
# This is what replaces the manual "Admin → Nodes → Pair daemon" dance:
# we mint a node UUID and HMAC signing key, insert the node row into
# Postgres, and write the daemon's config.toml to a shared volume. The
# daemon then boots and immediately starts pushing status callbacks to
# the API. No human step in the middle.
#
# Idempotent: if /shared/config.toml already exists we trust it and
# re-assert the node row (in case the DB was wiped without removing the
# config volume).
#
# Required env:
#   POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   PANEL_API_BASE_URL          (where the daemon callbacks)
#   DAEMON_LISTEN_HOST          (FQDN/IP the panel uses to reach the daemon)
#   DAEMON_LISTEN_PORT          (default 8443)
#   SFTP_LISTEN_PORT            (default 2022)
#   NODE_MEMORY_TOTAL_MB        (advisory cap; default 16384)
#   NODE_DISK_TOTAL_MB          (advisory cap; default 102400)

set -e

CONFIG_PATH="/shared/config.toml"
WAIT_LIMIT=60   # seconds

DAEMON_PORT="${DAEMON_LISTEN_PORT:-8443}"
SFTP_PORT="${SFTP_LISTEN_PORT:-2022}"
MEM_MB="${NODE_MEMORY_TOTAL_MB:-16384}"
DISK_MB="${NODE_DISK_TOTAL_MB:-102400}"

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -t -A -v ON_ERROR_STOP=1"

echo "[bootstrap] waiting for postgres at $POSTGRES_HOST ..."
i=0
until $PSQL -c "select 1" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge "$WAIT_LIMIT" ]; then
    echo "[bootstrap] postgres never came up; giving up" >&2
    exit 1
  fi
  sleep 1
done
echo "[bootstrap] postgres ready"

# Wait for the API to apply migrations before we try to insert into
# `nodes`. The API logs "api listening" once it's done.
echo "[bootstrap] waiting for nodes table ..."
i=0
until $PSQL -c "select to_regclass('public.nodes')" 2>/dev/null | grep -q nodes; do
  i=$((i + 1))
  if [ "$i" -ge "$WAIT_LIMIT" ]; then
    echo "[bootstrap] nodes table never created; API migrations may have failed" >&2
    exit 1
  fi
  sleep 1
done

# Reuse existing config if it's there, otherwise mint fresh.
if [ -s "$CONFIG_PATH" ]; then
  NODE_ID=$(grep -E '^node_id' "$CONFIG_PATH" | sed 's/.*= "\([^"]*\)".*/\1/')
  SIGNING_KEY=$(grep -E '^signing_key' "$CONFIG_PATH" | sed 's/.*= "\([^"]*\)".*/\1/')
  echo "[bootstrap] reusing existing config (node=$NODE_ID)"
else
  NODE_ID=$(cat /proc/sys/kernel/random/uuid)
  SIGNING_KEY=$(openssl rand -hex 32)
  echo "[bootstrap] minted new node id $NODE_ID"
fi

# Insert (or update) the node row. ON CONFLICT keeps this idempotent
# across re-deploys — if the user changes DAEMON_LISTEN_HOST we
# overwrite that field so the panel knows the new address.
$PSQL <<SQL
INSERT INTO nodes (
  id, name, fqdn, scheme, daemon_port, sftp_port,
  daemon_public_key, memory_total_mb, disk_total_mb
) VALUES (
  '${NODE_ID}', 'local', '${DAEMON_LISTEN_HOST}', 'http',
  ${DAEMON_PORT}, ${SFTP_PORT}, '${SIGNING_KEY}',
  ${MEM_MB}, ${DISK_MB}
)
ON CONFLICT (id) DO UPDATE SET
  fqdn = EXCLUDED.fqdn,
  daemon_port = EXCLUDED.daemon_port,
  sftp_port = EXCLUDED.sftp_port,
  daemon_public_key = EXCLUDED.daemon_public_key,
  memory_total_mb = EXCLUDED.memory_total_mb,
  disk_total_mb = EXCLUDED.disk_total_mb;
SQL

# Write the daemon config. Schema must match
# apps/daemon/internal/config/config.go's Load().
mkdir -p "$(dirname "$CONFIG_PATH")"
cat > "$CONFIG_PATH" <<TOML
node_id = "${NODE_ID}"
signing_key = "${SIGNING_KEY}"
api_base_url = "${PANEL_API_BASE_URL}"
listen_addr = "0.0.0.0:${DAEMON_PORT}"
sftp_listen_addr = "0.0.0.0:${SFTP_PORT}"
data_dir = "/var/lib/stellarstack"
TOML

# Touch a small marker so the operator can see when this last ran.
echo "$(date -u +%FT%TZ) node=${NODE_ID}" > /shared/bootstrap.last-run

echo "[bootstrap] wrote $CONFIG_PATH; daemon ready to start"
