#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/zhanggenhua/BoardGame}"
TAG="${1:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.preview.yml}"
ENV_FILE="${ENV_FILE:-.env.preview}"
OVERRIDE_FILE="${ROOT_DIR}/.compose.preview.images.generated.yml"

if [[ ! "$TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo "invalid image tag: $TAG" >&2
  exit 1
fi

cd "$ROOT_DIR"
cleanup() {
  rm -f "$OVERRIDE_FILE"
}
trap cleanup EXIT

cat >"$OVERRIDE_FILE" <<EOF
services:
  game-server:
    image: ghcr.io/zhuanggenhua/boardgame-game:${TAG}
  web:
    image: ghcr.io/zhuanggenhua/boardgame-web:${TAG}
EOF

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  -f "$OVERRIDE_FILE" \
  up -d --pull never --remove-orphans

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  -f "$OVERRIDE_FILE" \
  ps
