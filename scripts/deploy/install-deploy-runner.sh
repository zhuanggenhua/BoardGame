#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/admin/BoardGame}"
RUNNER_USER="${RUNNER_USER:-root}"
RUNNER_HOST="${RUNNER_HOST:-}"
RUNNER_PORT="${RUNNER_PORT:-18761}"
RUNNER_TOKEN="${RUNNER_TOKEN:-}"
UNIT_PATH="/etc/systemd/system/boardgame-deploy-runner.service"
ENV_PATH="/etc/boardgame-deploy-runner.env"

detect_docker_host_gateway() {
  if command -v ip >/dev/null 2>&1; then
    ip -4 addr show docker0 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -1
  fi
}

if [ ! -d "$ROOT_DIR" ]; then
  echo "boardgame deploy runner install failed: ROOT_DIR not found: $ROOT_DIR" >&2
  exit 1
fi

if [ -z "$RUNNER_TOKEN" ]; then
  if command -v openssl >/dev/null 2>&1; then
    RUNNER_TOKEN="$(openssl rand -hex 32)"
  else
    RUNNER_TOKEN="$(date +%s | sha256sum | awk '{print $1}')"
  fi
fi

if [ -z "$RUNNER_HOST" ]; then
  RUNNER_HOST="$(detect_docker_host_gateway)"
fi

if [ -z "$RUNNER_HOST" ]; then
  RUNNER_HOST="0.0.0.0"
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "boardgame deploy runner install failed: node not found" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "boardgame deploy runner install failed: need root or sudo" >&2
    exit 1
  fi
else
  SUDO=""
fi

cat <<EOF
Installing BoardGame deploy runner systemd service...
  root dir : ${ROOT_DIR}
  user     : ${RUNNER_USER}
  host     : ${RUNNER_HOST}
  port     : ${RUNNER_PORT}
EOF

$SUDO tee "$ENV_PATH" >/dev/null <<EOF
BG_DEPLOY_RUNNER_HOST=${RUNNER_HOST}
BG_DEPLOY_RUNNER_PORT=${RUNNER_PORT}
BG_DEPLOY_RUNNER_TOKEN=${RUNNER_TOKEN}
EOF
$SUDO chmod 600 "$ENV_PATH"

$SUDO tee "$UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=BoardGame Deploy Runner
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${RUNNER_USER}
WorkingDirectory=${ROOT_DIR}
EnvironmentFile=${ENV_PATH}
ExecStart=${NODE_BIN} ${ROOT_DIR}/scripts/deploy/deploy-runner.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now boardgame-deploy-runner.service

echo
echo "BoardGame deploy runner installed."
echo "Write this token into the web runtime env as BG_DEPLOY_RUNNER_TOKEN:"
echo "${RUNNER_TOKEN}"
