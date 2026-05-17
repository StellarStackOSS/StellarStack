#!/bin/sh
# Daemon entrypoint with optional auto-pair.
#
# If PAIRING_TOKEN is set and we haven't paired yet (no config.toml on
# the persisted data volume), exchange the token for a signing key
# first. This lets TrueNAS / Unraid / Portainer users deploy the daemon
# as a single env-var-configured container instead of running
# `stellar-daemon configure` by hand.
#
# After pairing (or if already paired), exec into the daemon with the
# command passed by the Dockerfile's CMD.

set -e

CONFIG_PATH="/etc/stellar-daemon/config.toml"
mkdir -p "$(dirname "$CONFIG_PATH")"

if [ -n "$PAIRING_TOKEN" ] && [ ! -s "$CONFIG_PATH" ]; then
  if [ -z "$PANEL_URL" ]; then
    echo "[entrypoint] PAIRING_TOKEN is set but PANEL_URL is empty — refusing to pair blindly" >&2
    exit 1
  fi
  echo "[entrypoint] pairing with $PANEL_URL …" >&2
  /usr/local/bin/stellar-daemon configure \
    "$PANEL_URL" "$PAIRING_TOKEN" \
    --out "$CONFIG_PATH" \
    --force
  echo "[entrypoint] paired; config written to $CONFIG_PATH" >&2
elif [ -s "$CONFIG_PATH" ]; then
  echo "[entrypoint] reusing existing config at $CONFIG_PATH" >&2
else
  echo "[entrypoint] no config and no PAIRING_TOKEN — set the token in your compose env and redeploy" >&2
  echo "[entrypoint] (panel: Admin → Nodes → Pair daemon)" >&2
  # Don't exit; the daemon will fail-fast on its own with a clearer message
  # so logs in TrueNAS UI explain what's missing.
fi

exec /usr/local/bin/stellar-daemon "$@"
