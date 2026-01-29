#!/usr/bin/env bash
set -euo pipefail

LOG_PREFIX="[快速部署]"

log() {
  echo "${LOG_PREFIX} $*"
}

APP_DIR="${APP_DIR:-/home/admin/BoardGame}"
REPO_URL="${REPO_URL:-https://github.com/zhuanggenhua/BoardGame.git}"
BRANCH="${BRANCH:-main}"

if [ ! -d "$APP_DIR/.git" ]; then
  log "未发现仓库，先克隆到 ${APP_DIR}"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "拉取最新代码"
cd "$APP_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git pull --rebase

log "重建并启动"
docker compose up -d --build

log "完成"
