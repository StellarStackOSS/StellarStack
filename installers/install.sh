#!/usr/bin/env bash
# StellarStack installer.
#
#   curl -fsSL https://stellarstack.io/install.sh | bash
#
# Three modes:
#   - full    : panel + api + daemon + Postgres + Redis + Caddy on one box
#   - panel   : panel + api + Postgres + Redis (pair daemons separately)
#   - daemon  : just the Go daemon, paired against an existing panel
#
# Re-runnable: detects existing installs and offers upgrade / reconfigure.

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants — replace once you've published real artifacts.
# ---------------------------------------------------------------------------

REPO_OWNER="${REPO_OWNER:-StellarStackOSS}"
REPO_NAME="${REPO_NAME:-StellarStack}"
DAEMON_REPO="${DAEMON_REPO:-StellarStackOSS/StellarStack}"
PANEL_IMAGE="${PANEL_IMAGE:-ghcr.io/stellarstackoss/panel:latest}"
API_IMAGE="${API_IMAGE:-ghcr.io/stellarstackoss/api:latest}"
DEFAULT_DATA_DIR="/var/lib/stellarstack"
DEFAULT_CONFIG_DIR="/etc/stellarstack"

# ---------------------------------------------------------------------------
# Pretty output (works without gum, looks nicer with).
# ---------------------------------------------------------------------------

C_RESET=$'\033[0m'
C_DIM=$'\033[2m'
C_GREEN=$'\033[32m'
C_RED=$'\033[31m'
C_YELLOW=$'\033[33m'
C_BOLD=$'\033[1m'

log()   { printf '%s•%s %s\n' "$C_DIM" "$C_RESET" "$*"; }
ok()    { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
fail()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
title() {
  printf '\n%s%s%s\n' "$C_BOLD" "$1" "$C_RESET"
}

# ---------------------------------------------------------------------------
# Bootstrap gum if missing — single static binary, downloaded into /tmp on
# first run so the script feels nice regardless of distro packaging.
# ---------------------------------------------------------------------------

ensure_gum() {
  if command -v gum >/dev/null 2>&1; then
    return 0
  fi

  # Charm publishes gum at
  #   https://github.com/charmbracelet/gum/releases/download/v<ver>/gum_<ver>_<OS>_<arch>.tar.gz
  # OS is capitalised (Linux, Darwin, …), arch uses {x86_64, arm64, armv6,
  # armv7, i386}. Pinned so the URL matches a real asset filename;
  # bumping is a one-line edit when a new version ships.
  local gum_version="0.17.0"
  local os arch url tmp
  case "$(uname -s)" in
    Linux)  os="Linux" ;;
    Darwin) os="Darwin" ;;
    *) fail "Unsupported OS: $(uname -s)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)  arch="x86_64" ;;
    aarch64|arm64) arch="arm64" ;;
    armv7l)        arch="armv7" ;;
    armv6l)        arch="armv6" ;;
    i386|i686)     arch="i386" ;;
    *) fail "Unsupported architecture: $(uname -m)" ;;
  esac

  log "Fetching gum (TUI helper)…"
  tmp=$(mktemp -d)
  url="https://github.com/charmbracelet/gum/releases/download/v${gum_version}/gum_${gum_version}_${os}_${arch}.tar.gz"
  curl -fsSL "$url" -o "$tmp/gum.tar.gz" \
    || fail "Couldn't download gum from $url"
  tar -xzf "$tmp/gum.tar.gz" -C "$tmp"
  install -m 0755 "$(find "$tmp" -name gum -type f -print -quit)" /usr/local/bin/gum
  rm -rf "$tmp"
  ok "Installed gum $gum_version"
}

# ---------------------------------------------------------------------------
# Pre-flight: distro / docker / ports / privileges.
# ---------------------------------------------------------------------------

require_root() {
  if [[ $EUID -ne 0 ]]; then
    fail "Run with sudo: 'curl ... | sudo bash'"
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    ok "Docker present ($(docker --version | awk '{print $3}' | tr -d ,))"
    return 0
  fi

  if gum confirm "Docker isn't installed. Install via get.docker.com now?"; then
    log "Running get.docker.com installer…"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    ok "Docker installed"
  else
    fail "Docker is required. Install it manually then re-run this script."
  fi
}

port_free() {
  ! ss -lntH "( sport = :$1 )" 2>/dev/null | grep -q .
}

# ---------------------------------------------------------------------------
# Mode picker.
# ---------------------------------------------------------------------------

pick_mode() {
  local choice
  choice=$(gum choose --header "What are you installing?" \
    "Full stack — panel + API + daemon on this box" \
    "Panel + API only — you'll pair daemons separately" \
    "Daemon only — pair to an existing panel" \
    "Cancel")
  case "$choice" in
    "Full stack"*) echo full ;;
    "Panel + API"*) echo panel ;;
    "Daemon only"*) echo daemon ;;
    *) exit 0 ;;
  esac
}

# ---------------------------------------------------------------------------
# Secret generation. Postgres password, JWT secret, better-auth secret.
# ---------------------------------------------------------------------------

random_hex() {
  head -c "$1" /dev/urandom | xxd -p -c 256
}

random_password() {
  # 24 url-safe chars
  head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24
}

write_env_once() {
  local env_path="$1"; shift
  if [[ -f "$env_path" ]]; then
    warn "$env_path already exists; leaving secrets untouched."
    return 0
  fi
  install -d -m 0700 "$(dirname "$env_path")"
  umask 077
  # Resolve secrets up front so DATABASE_URL gets the literal password
  # baked in. Compose's `env_file:` passes the file verbatim into the
  # container — it does NOT expand ${POSTGRES_PASSWORD}-style refs at
  # container start, so a templated URL would arrive at the API still
  # containing the literal '${POSTGRES_PASSWORD}' string.
  local pg_pw auth_secret jwt_secret
  pg_pw=$(random_password)
  auth_secret=$(random_hex 32)
  jwt_secret=$(random_hex 32)
  cat >"$env_path" <<EOF
# Generated by the StellarStack installer at $(date -u +%FT%TZ).
# Do NOT commit. Re-running the installer will not overwrite this file.

POSTGRES_USER=stellar
POSTGRES_PASSWORD=${pg_pw}
POSTGRES_DB=stellarstack

DATABASE_URL=postgresql://stellar:${pg_pw}@postgres:5432/stellarstack
REDIS_URL=redis://redis:6379

BETTER_AUTH_SECRET=${auth_secret}
JWT_SECRET=${jwt_secret}

PUBLIC_PANEL_URL=$1
APP_BASE_URL=$1
API_BASE_URL=$1
EOF
  chmod 0600 "$env_path"
  ok "Wrote $env_path"
}

# ---------------------------------------------------------------------------
# Mode: full / panel — both ride on docker compose, just with different
# service sets.
# ---------------------------------------------------------------------------

install_compose_stack() {
  local mode="$1"     # full | panel
  local config_dir="$2"
  local data_dir="$3"
  local panel_url="$4"
  local enable_tls="$5"

  install -d -m 0755 "$data_dir/postgres" "$data_dir/redis" "$data_dir/servers" \
    "$data_dir/backups" "$data_dir/caddy"

  write_env_once "$config_dir/.env" "$panel_url"

  fetch_template "docker-compose.${mode}.yml" "$config_dir/docker-compose.yml"
  fetch_template "Caddyfile.tmpl" "$config_dir/Caddyfile"
  sed -i "s|__PANEL_HOST__|${panel_url#https://}|g; s|__PANEL_HOST__|${panel_url#http://}|g" \
    "$config_dir/Caddyfile"
  if [[ "$enable_tls" != "true" ]]; then
    # Caddy: switch the site block to plain :80 when no TLS.
    sed -i "s|^${panel_url#https://}|:80|" "$config_dir/Caddyfile"
  fi

  ok "Wrote $config_dir/docker-compose.yml"

  log "Pulling images…"
  ( cd "$config_dir" && docker compose pull )

  log "Starting Postgres + Redis…"
  ( cd "$config_dir" && docker compose up -d postgres redis )

  log "Waiting for Postgres…"
  for _ in $(seq 1 30); do
    if ( cd "$config_dir" && docker compose exec -T postgres pg_isready -U stellar -d stellarstack >/dev/null 2>&1 ); then
      break
    fi
    sleep 1
  done

  log "Running migrations…"
  ( cd "$config_dir" && docker compose run --rm api node ./scripts/migrate.js ) \
    || fail "Migrations failed; the API container is paused. Inspect with 'docker compose logs api'."

  log "Starting api, panel, caddy…"
  ( cd "$config_dir" && docker compose up -d )

  ok "Stack online at $panel_url"
}

# ---------------------------------------------------------------------------
# Mode: daemon — just drop the binary, write a systemd unit, run configure.
# ---------------------------------------------------------------------------

install_daemon() {
  local panel_url="$1"
  local pairing_token="$2"
  local data_dir="$3"

  log "Fetching latest stellar-daemon…"
  local arch
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) fail "Unsupported architecture: $(uname -m)" ;;
  esac
  local url="https://github.com/${DAEMON_REPO}/releases/latest/download/stellar-daemon-linux-${arch}"
  curl -fsSL "$url" -o /usr/local/bin/stellar-daemon.new \
    || fail "Couldn't download stellar-daemon from $url"
  chmod 0755 /usr/local/bin/stellar-daemon.new
  mv /usr/local/bin/stellar-daemon.new /usr/local/bin/stellar-daemon
  ok "Installed /usr/local/bin/stellar-daemon"

  install -d -m 0755 "$data_dir"
  fetch_template "stellar-daemon.service" /etc/systemd/system/stellar-daemon.service
  sed -i "s|__DATA_DIR__|$data_dir|g" /etc/systemd/system/stellar-daemon.service

  log "Pairing daemon to $panel_url…"
  /usr/local/bin/stellar-daemon configure \
    --panel-url "$panel_url" \
    --token "$pairing_token" \
    --data-dir "$data_dir" \
    || fail "Pairing failed. Verify the panel URL and that the token hasn't expired."

  systemctl daemon-reload
  systemctl enable --now stellar-daemon
  ok "stellar-daemon running and paired"
}

# ---------------------------------------------------------------------------
# Resolve the path of this installer's templates/ dir.
# ---------------------------------------------------------------------------

installer_dir() {
  local src
  if [[ -n "${INSTALLER_DIR:-}" ]]; then
    echo "$INSTALLER_DIR"
    return
  fi
  src="${BASH_SOURCE[0]}"
  # Bash sets BASH_SOURCE[0] to /dev/fd/<N> when piped from curl, which
  # has no parent directory we can look beside. In that case echo "" so
  # callers know to fall back to the network fetch.
  if [[ -z "$src" || "$src" == /dev/fd/* || "$src" == /proc/self/fd/* || "$src" == /dev/stdin ]]; then
    return 0
  fi
  while [[ -h "$src" ]]; do
    src=$(readlink "$src")
  done
  ( cd "$(dirname "$src")" && pwd ) 2>/dev/null
}

# Fetch a template by name into a destination path. Prefers the local
# templates/ directory if the installer was run from a checkout; falls
# back to curling from the repo's raw URL when run via `curl … | bash`.
TEMPLATE_BASE_URL="${TEMPLATE_BASE_URL:-https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/installers/templates}"

fetch_template() {
  local name="$1" dest="$2" dir
  dir=$(installer_dir)
  if [[ -n "$dir" && -f "$dir/templates/$name" ]]; then
    cp "$dir/templates/$name" "$dest"
  else
    curl -fsSL "${TEMPLATE_BASE_URL}/$name" -o "$dest" \
      || fail "Couldn't download template $name from $TEMPLATE_BASE_URL"
  fi
}

# ---------------------------------------------------------------------------
# Sub-command: uninstall — interactive, walks the operator through three
# confirmations.
# ---------------------------------------------------------------------------

uninstall() {
  if gum confirm "Stop and remove the docker compose stack at $DEFAULT_CONFIG_DIR?"; then
    if [[ -f "$DEFAULT_CONFIG_DIR/docker-compose.yml" ]]; then
      ( cd "$DEFAULT_CONFIG_DIR" && docker compose down -v )
    fi
  fi
  if systemctl list-unit-files | grep -q stellar-daemon.service; then
    if gum confirm "Stop and remove the stellar-daemon systemd service?"; then
      systemctl disable --now stellar-daemon
      rm -f /etc/systemd/system/stellar-daemon.service
      systemctl daemon-reload
      rm -f /usr/local/bin/stellar-daemon
    fi
  fi
  if gum confirm "Wipe data directory $DEFAULT_DATA_DIR? (irreversible)"; then
    rm -rf "$DEFAULT_DATA_DIR"
  fi
  ok "Uninstall complete."
}

# ---------------------------------------------------------------------------
# Sub-command: reset — debug mode. Wipes EVERYTHING without prompting:
# compose stack, systemd unit, daemon binary, /etc/stellarstack,
# /var/lib/stellarstack, dangling images. Use during install testing
# to get back to a fresh box in one command. Pass --force to skip the
# single 'are you sure' confirmation, useful in CI loops.
#
#   bash install.sh reset           # one confirmation, then nuke
#   bash install.sh reset --force   # no prompts at all
# ---------------------------------------------------------------------------

reset_all() {
  local force="${1:-}"
  if [[ "$force" != "--force" && "$force" != "-y" ]]; then
    title "StellarStack — reset"
    warn "This wipes EVERYTHING:"
    printf '    • docker compose stack at %s (containers + named volumes)\n' "$DEFAULT_CONFIG_DIR"
    printf '    • systemd unit /etc/systemd/system/stellar-daemon.service\n'
    printf '    • binary /usr/local/bin/stellar-daemon\n'
    printf '    • config dir %s (.env + compose + Caddyfile)\n' "$DEFAULT_CONFIG_DIR"
    printf '    • data dir %s (Postgres data, backups, server bind mounts)\n' "$DEFAULT_DATA_DIR"
    printf '    • dangling stellarstack/* docker images\n\n'
    if ! gum confirm "Proceed?" --default=false; then
      log "Aborted."
      exit 0
    fi
  fi

  log "Stopping compose stack…"
  if [[ -f "$DEFAULT_CONFIG_DIR/docker-compose.yml" ]]; then
    ( cd "$DEFAULT_CONFIG_DIR" && docker compose down -v --remove-orphans ) 2>/dev/null || true
  fi
  ok "Compose stack stopped"

  log "Removing systemd unit…"
  if systemctl list-unit-files 2>/dev/null | grep -q stellar-daemon.service; then
    systemctl disable --now stellar-daemon 2>/dev/null || true
  fi
  rm -f /etc/systemd/system/stellar-daemon.service
  systemctl daemon-reload 2>/dev/null || true
  rm -f /usr/local/bin/stellar-daemon /usr/local/bin/stellar-daemon.new /usr/local/bin/stellar-daemon.bak
  ok "Systemd + binary removed"

  log "Removing config + data dirs…"
  rm -rf "$DEFAULT_CONFIG_DIR" "$DEFAULT_DATA_DIR"
  ok "Removed $DEFAULT_CONFIG_DIR and $DEFAULT_DATA_DIR"

  log "Pruning dangling stellarstack images…"
  # Untag (don't force) — leaves layers in the cache so the next
  # 'compose pull' is fast, but kills the local :latest pointers so
  # the next install always grabs a fresh manifest.
  for repo in api panel daemon; do
    docker image rm "ghcr.io/stellarstackoss/${repo}:latest" 2>/dev/null || true
  done
  ok "Image tags cleared"

  title "Reset complete. Re-run with: install.sh full|panel|daemon"
}

# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

main() {
  # Reset cwd to / before doing anything. If the operator just ran
  # 'reset' from inside /etc/stellarstack, that directory's gone but
  # bash still thinks it's the cwd. Every subprocess (gum, docker,
  # systemctl, install -d) then prints 'job-working-directory: error
  # retrieving current directory'. Stepping out of it makes the rest
  # of the script silent and reliable.
  cd / || true
  require_root
  ensure_gum

  if [[ "${1:-}" == "uninstall" ]]; then
    uninstall
    exit 0
  fi

  if [[ "${1:-}" == "reset" ]]; then
    reset_all "${2:-}"
    exit 0
  fi

  title "StellarStack — installer"

  local mode
  if [[ "${1:-}" =~ ^(full|panel|daemon)$ ]]; then
    mode="$1"
  else
    mode=$(pick_mode)
  fi

  case "$mode" in
    full|panel)
      ensure_docker
      local panel_host enable_tls panel_url
      panel_host=$(gum input --header "Panel hostname" --placeholder "panel.example.com" --value "panel.$(hostname -f 2>/dev/null || echo example.com)")
      [[ -n "$panel_host" ]] || fail "Hostname required."
      if gum confirm "Issue TLS via Let's Encrypt for $panel_host?"; then
        enable_tls=true
        panel_url="https://$panel_host"
      else
        enable_tls=false
        panel_url="http://$panel_host"
      fi
      local data_dir
      data_dir=$(gum input --header "Data directory" --value "$DEFAULT_DATA_DIR")
      [[ -n "$data_dir" ]] || data_dir="$DEFAULT_DATA_DIR"

      port_free 80 || warn "Port 80 already in use — Caddy will fail to bind."
      [[ "$enable_tls" != "true" ]] || port_free 443 || warn "Port 443 already in use."

      install_compose_stack "$mode" "$DEFAULT_CONFIG_DIR" "$data_dir" "$panel_url" "$enable_tls"
      title "Done."
      printf '  Panel:  %s\n' "$panel_url"
      printf '  Admin:  set up at %s/register on first visit\n' "$panel_url"
      [[ "$mode" != "panel" ]] || printf '  Pair a daemon: this script | bash -s -- daemon\n'
      ;;
    daemon)
      local panel_url pairing_token data_dir
      panel_url=$(gum input --header "Panel URL (https://panel.example.com)" --placeholder "https://panel.example.com")
      pairing_token=$(gum input --header "Pairing token (from the panel's Admin → Nodes → Add)" --password)
      data_dir=$(gum input --header "Data directory" --value "$DEFAULT_DATA_DIR")
      [[ -n "$panel_url" ]] || fail "Panel URL required."
      [[ -n "$pairing_token" ]] || fail "Pairing token required."
      [[ -n "$data_dir" ]] || data_dir="$DEFAULT_DATA_DIR"
      install_daemon "$panel_url" "$pairing_token" "$data_dir"
      title "Done."
      printf '  Daemon paired to %s\n' "$panel_url"
      printf '  Logs: journalctl -u stellar-daemon -f\n'
      ;;
  esac
}

main "$@"
