#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/admin/BoardGame}"
WATCH_USER="${WATCH_USER:-root}"
UNIT_PATH="/etc/systemd/system/boardgame-game-server-cpu-watch.service"
TIMER_PATH="/etc/systemd/system/boardgame-game-server-cpu-watch.timer"
ENV_PATH="/etc/boardgame-game-server-cpu-watch.env"
PROJECT_ENV_PATH="${ROOT_DIR}/.env"

if [ ! -d "$ROOT_DIR" ]; then
  echo "boardgame game-server CPU watch install failed: ROOT_DIR not found: $ROOT_DIR" >&2
  exit 1
fi

if [ ! -f "$ROOT_DIR/scripts/deploy/watch-game-server-cpu.sh" ]; then
  echo "boardgame game-server CPU watch install failed: script not found under ROOT_DIR" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "boardgame game-server CPU watch install failed: need root or sudo" >&2
    exit 1
  fi
else
  SUDO=""
fi

cat <<EOF
Installing BoardGame game-server CPU watch systemd timer...
  root dir : ${ROOT_DIR}
  user     : ${WATCH_USER}
  threshold: ${BG_GAME_SERVER_CPU_THRESHOLD:-80}%
  restart  : ${BG_GAME_SERVER_CPU_WATCH_RESTART:-0}
EOF

$SUDO tee "$ENV_PATH" >/dev/null <<EOF
BG_GAME_SERVER_CONTAINER=${BG_GAME_SERVER_CONTAINER:-boardgame-game-server}
BG_GAME_SERVER_CPU_THRESHOLD=${BG_GAME_SERVER_CPU_THRESHOLD:-80}
BG_GAME_SERVER_CPU_SAMPLE_COUNT=${BG_GAME_SERVER_CPU_SAMPLE_COUNT:-3}
BG_GAME_SERVER_CPU_SAMPLE_INTERVAL_SECONDS=${BG_GAME_SERVER_CPU_SAMPLE_INTERVAL_SECONDS:-20}
BG_GAME_SERVER_CPU_RESTART_COOLDOWN_SECONDS=${BG_GAME_SERVER_CPU_RESTART_COOLDOWN_SECONDS:-600}
BG_GAME_SERVER_CPU_FEEDBACK_COOLDOWN_SECONDS=${BG_GAME_SERVER_CPU_FEEDBACK_COOLDOWN_SECONDS:-600}
BG_GAME_SERVER_CPU_LOG_SINCE=${BG_GAME_SERVER_CPU_LOG_SINCE:-10m}
BG_GAME_SERVER_CPU_EVIDENCE_DIR=${BG_GAME_SERVER_CPU_EVIDENCE_DIR:-${ROOT_DIR}/logs/game-server-cpu-watch}
BG_GAME_SERVER_CPU_HISTORY_LOG=${BG_GAME_SERVER_CPU_HISTORY_LOG:-${ROOT_DIR}/logs/game-server-cpu-watch/restart-history.log}
BG_GAME_SERVER_CPU_FEEDBACK_URL=${BG_GAME_SERVER_CPU_FEEDBACK_URL:-http://127.0.0.1/internal/feedback/system}
BG_GAME_SERVER_CPU_FEEDBACK=${BG_GAME_SERVER_CPU_FEEDBACK:-1}
# 默认只报警和留档；确认要自动重启时，安装命令里显式传 BG_GAME_SERVER_CPU_WATCH_RESTART=1。
BG_GAME_SERVER_CPU_WATCH_RESTART=${BG_GAME_SERVER_CPU_WATCH_RESTART:-0}
EOF
$SUDO chmod 600 "$ENV_PATH"

$SUDO tee "$UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=BoardGame Game Server CPU Watch
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
User=${WATCH_USER}
WorkingDirectory=${ROOT_DIR}
EnvironmentFile=-${PROJECT_ENV_PATH}
EnvironmentFile=${ENV_PATH}
ExecStart=/usr/bin/env bash ${ROOT_DIR}/scripts/deploy/watch-game-server-cpu.sh
SuccessExitStatus=2
EOF

$SUDO tee "$TIMER_PATH" >/dev/null <<EOF
[Unit]
Description=Run BoardGame Game Server CPU Watch

[Timer]
OnBootSec=2min
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true

[Install]
WantedBy=timers.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now boardgame-game-server-cpu-watch.timer

echo
echo "BoardGame game-server CPU watch timer installed."
echo "Check timer: systemctl status boardgame-game-server-cpu-watch.timer"
echo "Check last run: systemctl status boardgame-game-server-cpu-watch.service"
echo "History log: ${BG_GAME_SERVER_CPU_HISTORY_LOG:-${ROOT_DIR}/logs/game-server-cpu-watch/restart-history.log}"
