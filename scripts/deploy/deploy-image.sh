#!/usr/bin/env bash
set -euo pipefail

# 镜像部署脚本（生产环境推荐）
# 用法：bash scripts/deploy/deploy-image.sh [update|rollback <tag>]
# 文档：docs/deploy.md

LOG_PREFIX="[镜像部署]"

log() {
  echo "${LOG_PREFIX} $*"
}

die() {
  echo "${LOG_PREFIX} 错误: $*" >&2
  exit 1
}

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_URL="https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/docker-compose.prod.yml"

# 检查 Docker
if ! command -v docker &>/dev/null; then
  die "Docker 未安装，请先安装 Docker"
fi

# 检查 compose 文件
ensure_compose_file() {
  if [ ! -f "$COMPOSE_FILE" ]; then
    log "下载 $COMPOSE_FILE"
    curl -fsSL "$COMPOSE_URL" -o "$COMPOSE_FILE"
  fi
}

# 检查 .env 文件
ensure_env_file() {
  if [ -f ".env" ]; then
    return
  fi

  # 优先使用 .env.server 脚本生成
  if [ -f ".env.server" ]; then
    log "检测到 .env.server，执行生成 .env"
    bash .env.server "$(pwd)"
    return
  fi

  # 兜底：自动生成最小 .env
  log "未找到 .env 和 .env.server，自动生成最小 .env"
  local jwt_secret
  if command -v openssl &>/dev/null; then
    jwt_secret=$(openssl rand -hex 32)
  else
    jwt_secret=$(date +%s | sha256sum | awk '{print $1}')
  fi
  cat > .env << EOF
JWT_SECRET=${jwt_secret}
WEB_ORIGINS=http://localhost
EOF
  log ".env 已创建（请修改 WEB_ORIGINS 为实际域名）"
}

# 部署/更新
deploy() {
  ensure_compose_file
  ensure_env_file

  log "拉取最新镜像"
  docker compose -f "$COMPOSE_FILE" pull

  log "启动服务"
  docker compose -f "$COMPOSE_FILE" up -d

  log "部署完成"
  docker compose -f "$COMPOSE_FILE" ps
}

# 回滚到指定版本
rollback() {
  local tag="${1:-}"
  if [ -z "$tag" ]; then
    die "请指定要回滚的版本 tag，例如：bash deploy-image.sh rollback v1.2.3"
  fi

  ensure_compose_file

  log "回滚到版本 ${tag}"

  # 修改 compose 文件中的镜像 tag
  sed -i.bak \
    -e "s|ghcr.io/zhuanggenhua/boardgame-game:.*|ghcr.io/zhuanggenhua/boardgame-game:${tag}|g" \
    -e "s|ghcr.io/zhuanggenhua/boardgame-web:.*|ghcr.io/zhuanggenhua/boardgame-web:${tag}|g" \
    "$COMPOSE_FILE"

  log "拉取指定版本镜像"
  docker compose -f "$COMPOSE_FILE" pull

  log "重启服务"
  docker compose -f "$COMPOSE_FILE" up -d

  log "回滚完成"
  docker compose -f "$COMPOSE_FILE" ps
}

# 查看状态
status() {
  ensure_compose_file
  docker compose -f "$COMPOSE_FILE" ps
}

# 查看日志
logs() {
  ensure_compose_file
  docker compose -f "$COMPOSE_FILE" logs -f "${1:-}"
}

# 主入口
case "${1:-deploy}" in
  deploy|update)
    deploy
    ;;
  rollback)
    rollback "${2:-}"
    ;;
  status)
    status
    ;;
  logs)
    logs "${2:-}"
    ;;
  *)
    echo "用法: $0 [deploy|update|rollback <tag>|status|logs [service]]"
    exit 1
    ;;
esac
