#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${PM2_APP_NAME:-hi-image-studio}"
PM2_CONFIG="${PM2_CONFIG:-$ROOT_DIR/ecosystem.config.cjs}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

install_deps() {
  if [[ -f "$ROOT_DIR/package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi

  if [[ -f "$ROOT_DIR/server/package-lock.json" ]]; then
    npm ci --prefix server
  else
    npm install --prefix server
  fi
}

reload_pm2() {
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$PM2_CONFIG" --only "$APP_NAME" --update-env
  else
    pm2 start "$PM2_CONFIG" --only "$APP_NAME" --update-env
  fi

  pm2 save
}

main() {
  require_cmd node
  require_cmd npm
  require_cmd pm2

  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    echo "Missing .env in $ROOT_DIR" >&2
    echo "Copy .env.example to .env and fill in production values first." >&2
    exit 1
  fi

  if [[ ! -f "$PM2_CONFIG" ]]; then
    echo "Missing PM2 config: $PM2_CONFIG" >&2
    exit 1
  fi

  cd "$ROOT_DIR"

  log "Installing dependencies"
  install_deps

  log "Building application"
  npm run build

  log "Starting application with PM2"
  reload_pm2

  log "Deployment complete"
  pm2 status "$APP_NAME"
}

main "$@"
