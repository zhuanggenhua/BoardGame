#!/usr/bin/env bash
set -euo pipefail

# 镜像部署脚本（一键部署，生产环境推荐，无需 Git）
#
# 用法：
#   首次部署：  bash deploy-image.sh
#   首次部署指定 tag：bash deploy-image.sh deploy v1.2.3
#   更新版本（服务器直拉 GHCR 旧链路）：bash deploy-image.sh update [tag]
#   使用本地已导入镜像更新（默认发布链路）：bash deploy-image.sh update-local [tag]
#   回滚版本：  bash deploy-image.sh rollback <tag>
#   回滚到上次部署：bash deploy-image.sh rollback-last
#   配置镜像源：bash deploy-image.sh configure-mirror
#   初始化管理员：bash deploy-image.sh init-admin
#   查看状态：  bash deploy-image.sh status
#   查看日志：  bash deploy-image.sh logs [service]
#
# 日常生产更新默认从本机/CI 执行 scripts/deploy/stream-images-to-server.mjs --deploy，
# 让服务器本地导入镜像后走 update-local。以下远程执行仅用于首次部署或显式直拉 GHCR：
#   curl -fsSL https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/scripts/deploy/deploy-image.sh -o deploy-image.sh
#   bash deploy-image.sh update
#
# 环境变量（可选，用于非交互环境）：
#   JWT_SECRET=xxx bash deploy-image.sh
#   DEPLOY_TOTAL_TIMEOUT_SECONDS=1800 bash deploy-image.sh update-local
#   DEPLOY_IMAGE_PULL_TIMEOUT_SECONDS=1800 bash deploy-image.sh update
#
# 架构：Cloudflare CDN (HTTPS) → 服务器 80 端口 → Docker web 容器 (NestJS monolith) → 内部 game-server
# 同域部署，无 CORS 问题。Cloudflare 自动缓存静态资源，服务器只承担 API 和 WebSocket 带宽。
#
# 文档：docs/deploy.md

LOG_PREFIX="[镜像部署]"

log() {
  echo "${LOG_PREFIX} $*"
}

die() {
  echo "${LOG_PREFIX} 错误: $*" >&2
  exit 1
}

DEPLOY_TOTAL_TIMEOUT_SECONDS="${DEPLOY_TOTAL_TIMEOUT_SECONDS:-1800}"

run_with_total_timeout_if_needed() {
  local action="${1:-deploy}"
  local timeout_seconds="${DEPLOY_TOTAL_TIMEOUT_SECONDS:-1800}"
  local script_path="${BASH_SOURCE[0]}"
  local timeout_status=0

  case "$action" in
    deploy|update|deploy-local|update-local|rollback|rollback-last)
      ;;
    *)
      return 0
      ;;
  esac

  if [ "${BG_DEPLOY_TOTAL_TIMEOUT_ACTIVE:-0}" = "1" ]; then
    return 0
  fi

  if ! [[ "$timeout_seconds" =~ ^[0-9]+$ ]]; then
    die "DEPLOY_TOTAL_TIMEOUT_SECONDS 必须是非负整数秒：${timeout_seconds}"
  fi

  if [ "$timeout_seconds" -eq 0 ]; then
    return 0
  fi

  if ! command -v timeout >/dev/null 2>&1; then
    die "缺少 timeout 命令，无法为整次部署提供 ${timeout_seconds}s 总时限保护"
  fi

  if [ ! -f "$script_path" ]; then
    die "变更操作必须从已下载的脚本文件执行，不能通过管道直接执行；否则无法提供整次部署总时限保护"
  fi

  log "整次部署总时限：${timeout_seconds}s"
  BG_DEPLOY_TOTAL_TIMEOUT_ACTIVE=1 \
    timeout --signal=TERM --kill-after=30s "${timeout_seconds}s" \
      bash "$script_path" "$@" || timeout_status=$?

  if [ "$timeout_status" -eq 124 ] || [ "$timeout_status" -eq 137 ]; then
    die "整次部署超过 ${timeout_seconds}s，已终止本次操作；请确认当前容器状态后再决定是否重试或改走镜像流式分发"
  fi

  exit "$timeout_status"
}

run_with_total_timeout_if_needed "$@"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_URL="https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/docker-compose.prod.yml"
WEB_IMAGE_REPO="ghcr.io/zhuanggenhua/boardgame-web"
GAME_IMAGE_REPO="ghcr.io/zhuanggenhua/boardgame-game"
WEB_CONTAINER_NAME="boardgame-web"
GAME_CONTAINER_NAME="boardgame-game-server"
MONGODB_CONTAINER_NAME="boardgame-mongodb"
REDIS_CONTAINER_NAME="boardgame-redis"
APP_SERVICES=(game-server web)
COMPOSE_PROJECT_NAME_EFFECTIVE="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]')}"
DEPLOY_STATE_FILE="${DEPLOY_STATE_FILE:-.deploy-last-success.env}"
DEPLOY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-off}"
PUBLIC_ENTRY_SYNC_SOURCE_URL="${PUBLIC_ENTRY_SYNC_SOURCE_URL:-http://127.0.0.1/}"
PUBLIC_ENTRY_SYNC_RETRY="${PUBLIC_ENTRY_SYNC_RETRY:-4}"
PUBLIC_ENTRY_SYNC_DELAY="${PUBLIC_ENTRY_SYNC_DELAY:-5}"
REQUIRE_PUBLIC_ENTRY_SYNC="${REQUIRE_PUBLIC_ENTRY_SYNC:-1}"
CLOUDFLARE_PURGE_MODE="${CLOUDFLARE_PURGE_MODE:-auto}"
DEPLOY_IMAGE_PULL_TIMEOUT_SECONDS="${DEPLOY_IMAGE_PULL_TIMEOUT_SECONDS:-1800}"

PREVIOUS_WEB_IMAGE_REF=""
PREVIOUS_GAME_IMAGE_REF=""
ROLLBACK_READY="0"
TARGET_WEB_IMAGE_REF=""
TARGET_GAME_IMAGE_REF=""

# 检查 Docker
if ! command -v docker &>/dev/null; then
  die "Docker 未安装，请先安装 Docker"
fi

# sudo 检测
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo &>/dev/null; then
    SUDO="sudo"
  else
    die "需要 root 或 sudo 权限"
  fi
fi

# ============================================================
# Docker 镜像加速
# ============================================================

has_docker_mirror_config() {
  local daemon_file="${1:-/etc/docker/daemon.json}"

  if [ ! -f "$daemon_file" ]; then
    return 1
  fi

  grep -q "registry-mirrors" "$daemon_file" 2>/dev/null
}

check_docker_mirror_config() {
  if [ "${SKIP_MIRROR:-0}" = "1" ]; then
    log "已跳过镜像源检查（SKIP_MIRROR=1）"
    return
  fi

  local daemon_file="/etc/docker/daemon.json"

  if has_docker_mirror_config "$daemon_file"; then
    log "检测到已有镜像配置"
    return
  fi

  log "⚠️  未检测到 Docker 镜像加速配置"
  log "⚠️  生产部署默认不会修改 Docker daemon；如需显式写入镜像源，请执行: bash deploy-image.sh configure-mirror"
}

configure_docker_mirror() {
  if [ "${SKIP_MIRROR:-0}" = "1" ]; then
    log "已跳过镜像源配置（SKIP_MIRROR=1）"
    return
  fi

  if has_docker_mirror_config "/etc/docker/daemon.json"; then
    log "检测到已有镜像配置，跳过"
    return
  fi

  if [ -t 0 ]; then
    echo -n "${LOG_PREFIX} 将写入 Docker 镜像源并对 dockerd 发送 SIGHUP，不会自动重启 Docker。是否继续？[Y/n] "
    local choice
    read -r choice || choice="y"
    if [[ "$choice" =~ ^[nN] ]]; then
      log "跳过镜像配置"
      return
    fi
  fi

  apply_docker_mirror
}

apply_docker_mirror() {
  local daemon_file="/etc/docker/daemon.json"
  local mirrors_json='["https://mirror.aliyuncs.com","https://docker.mirrors.ustc.edu.cn","https://docker.mirrors.sjtug.sjtu.edu.cn","https://docker.m.daocloud.io","https://dockerproxy.com"]'
  local python_bin tmp_file

  python_bin="$(command -v python3 || command -v python || true)"
  if [ -z "$python_bin" ]; then
    die "配置镜像源需要 python3 或 python，以便保留现有 Docker daemon 配置"
  fi

  log "配置 Docker 镜像源"
  $SUDO mkdir -p /etc/docker

  tmp_file="$(mktemp)"
  if [ -f "$daemon_file" ]; then
    $SUDO cp "$daemon_file" "${daemon_file}.bak.$(date +%s)"
  fi

  if ! "$python_bin" - "$daemon_file" "$mirrors_json" > "$tmp_file" <<'PY'
import json
import pathlib
import sys

daemon_path = pathlib.Path(sys.argv[1])
mirrors = json.loads(sys.argv[2])

if daemon_path.exists():
    raw = daemon_path.read_text(encoding="utf-8").strip()
    data = json.loads(raw) if raw else {}
else:
    data = {}

if not isinstance(data, dict):
    raise SystemExit("Docker daemon.json 必须是 JSON 对象")

data["registry-mirrors"] = mirrors
json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
sys.stdout.write("\n")
PY
  then
    rm -f "$tmp_file"
    die "生成新的 Docker daemon.json 失败"
  fi

  $SUDO tee "$daemon_file" < "$tmp_file" > /dev/null
  rm -f "$tmp_file"

  if pidof dockerd >/dev/null 2>&1; then
    $SUDO kill -SIGHUP "$(pidof dockerd)"
    log "已向 dockerd 发送 SIGHUP 重新加载配置"
    log "若 docker info 仍显示旧 registry mirrors，请在维护窗口手动重启 Docker"
  fi

  log "✅ 镜像加速配置已写入"
}

# ============================================================
# Compose 文件
# ============================================================

ensure_compose_file() {
  if [ ! -f "$COMPOSE_FILE" ]; then
    log "首次下载 $COMPOSE_FILE"
    curl -fsSL "$COMPOSE_URL" -o "$COMPOSE_FILE"
  else
    # 每次部署/更新都拉最新 compose 文件，确保配置变更能到达服务器
    log "更新 $COMPOSE_FILE"
    local tmp_file="${COMPOSE_FILE}.tmp"
    if curl -fsSL "$COMPOSE_URL" -o "$tmp_file" 2>/dev/null; then
      if ! diff -q "$COMPOSE_FILE" "$tmp_file" &>/dev/null; then
        cp "$COMPOSE_FILE" "${COMPOSE_FILE}.bak.$(date +%s)"
        mv "$tmp_file" "$COMPOSE_FILE"
        log "✅ compose 文件已更新（旧版本已备份）"
      else
        rm -f "$tmp_file"
        log "compose 文件无变化"
      fi
    else
      log "⚠️  无法下载最新 compose 文件，使用本地版本"
      rm -f "$tmp_file"
    fi
  fi
}

validate_tag() {
  local tag="${1:-}"
  if [ -z "$tag" ]; then
    die "镜像 tag 不能为空"
  fi

  if [[ ! "$tag" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    die "镜像 tag 格式无效：${tag}"
  fi
}

set_compose_image_tag() {
  local tag="${1:-latest}"
  validate_tag "$tag"

  set_compose_image_refs "${GAME_IMAGE_REPO}:${tag}" "${WEB_IMAGE_REPO}:${tag}"
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

set_compose_image_refs() {
  local game_ref="${1:-}"
  local web_ref="${2:-}"

  if [ -z "$game_ref" ] || [ -z "$web_ref" ]; then
    die "set_compose_image_refs 缺少镜像引用"
  fi

  local escaped_game_ref escaped_web_ref
  escaped_game_ref="$(escape_sed_replacement "$game_ref")"
  escaped_web_ref="$(escape_sed_replacement "$web_ref")"
  TARGET_GAME_IMAGE_REF="$game_ref"
  TARGET_WEB_IMAGE_REF="$web_ref"

  sed -i.bak \
    -e "s|${GAME_IMAGE_REPO}[^[:space:]]*|${escaped_game_ref}|g" \
    -e "s|${WEB_IMAGE_REPO}[^[:space:]]*|${escaped_web_ref}|g" \
    "$COMPOSE_FILE"
}

get_container_repo_digest() {
  local container_name="${1:-}"
  local image_id repo_digest

  if ! docker container inspect "$container_name" >/dev/null 2>&1; then
    return 1
  fi

  image_id=$(docker inspect --format '{{.Image}}' "$container_name" 2>/dev/null || true)
  if [ -z "$image_id" ]; then
    return 1
  fi

  repo_digest=$(docker image inspect "$image_id" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)
  if [ -n "$repo_digest" ] && [ "$repo_digest" != "<no value>" ]; then
    printf '%s' "$repo_digest"
    return 0
  fi

  return 1
}

get_container_image_reference() {
  local container_name="${1:-}"
  local repo_digest config_image image_id

  repo_digest=$(get_container_repo_digest "$container_name" || true)
  if [ -n "$repo_digest" ]; then
    printf '%s' "$repo_digest"
    return 0
  fi

  if docker container inspect "$container_name" >/dev/null 2>&1; then
    config_image=$(docker inspect --format '{{.Config.Image}}' "$container_name" 2>/dev/null || true)
    if [ -n "$config_image" ] && [ "$config_image" != "<no value>" ]; then
      printf '%s' "$config_image"
      return 0
    fi

    image_id=$(docker inspect --format '{{.Image}}' "$container_name" 2>/dev/null || true)
    if [ -n "$image_id" ]; then
      printf '%s' "$image_id"
      return 0
    fi
  fi

  return 1
}

snapshot_current_runtime_refs() {
  PREVIOUS_WEB_IMAGE_REF=""
  PREVIOUS_GAME_IMAGE_REF=""
  ROLLBACK_READY="0"

  PREVIOUS_WEB_IMAGE_REF=$(get_container_image_reference "$WEB_CONTAINER_NAME" || true)
  PREVIOUS_GAME_IMAGE_REF=$(get_container_image_reference "$GAME_CONTAINER_NAME" || true)

  if [ -n "$PREVIOUS_WEB_IMAGE_REF" ] && [ -n "$PREVIOUS_GAME_IMAGE_REF" ]; then
    ROLLBACK_READY="1"
    log "已记录部署前镜像引用"
    log "  - web: ${PREVIOUS_WEB_IMAGE_REF}"
    log "  - game-server: ${PREVIOUS_GAME_IMAGE_REF}"
  else
    log "⚠️  未检测到完整的部署前运行镜像引用；若本次 smoke 失败，将无法自动回退"
  fi
}

write_deploy_state() {
  local previous_web_ref="${1:-}"
  local previous_game_ref="${2:-}"
  local current_web_ref="${3:-}"
  local current_game_ref="${4:-}"
  local action="${5:-deploy}"
  local updated_at

  updated_at="$(date -Iseconds)"

  cat > "$DEPLOY_STATE_FILE" <<EOF
DEPLOY_STATE_UPDATED_AT=${updated_at}
DEPLOY_STATE_ACTION=${action}
DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF=${previous_web_ref}
DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF=${previous_game_ref}
DEPLOY_STATE_CURRENT_WEB_IMAGE_REF=${current_web_ref}
DEPLOY_STATE_CURRENT_GAME_IMAGE_REF=${current_game_ref}
EOF
}

record_successful_runtime_state() {
  local action="${1:-deploy}"
  local current_web_ref current_game_ref

  current_web_ref=$(get_container_image_reference "$WEB_CONTAINER_NAME" || true)
  current_game_ref=$(get_container_image_reference "$GAME_CONTAINER_NAME" || true)

  if [ -z "$current_web_ref" ] || [ -z "$current_game_ref" ]; then
    log "⚠️  无法记录成功部署状态：未获取到当前运行镜像引用"
    return 1
  fi

  write_deploy_state \
    "$PREVIOUS_WEB_IMAGE_REF" \
    "$PREVIOUS_GAME_IMAGE_REF" \
    "$current_web_ref" \
    "$current_game_ref" \
    "$action"

  log "✅ 已记录成功部署状态到 ${DEPLOY_STATE_FILE}"
  return 0
}

load_deploy_state() {
  if [ ! -f "$DEPLOY_STATE_FILE" ]; then
    die "未找到部署状态文件 ${DEPLOY_STATE_FILE}，无法回滚到上次部署"
  fi

  # shellcheck disable=SC1090
  . "$DEPLOY_STATE_FILE"

  if [ -z "${DEPLOY_STATE_CURRENT_WEB_IMAGE_REF:-}" ] || [ -z "${DEPLOY_STATE_CURRENT_GAME_IMAGE_REF:-}" ]; then
    die "部署状态文件缺少当前镜像引用，无法回滚到上次部署"
  fi

  if [ -z "${DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF:-}" ] || [ -z "${DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF:-}" ]; then
    die "部署状态文件中没有上次部署镜像引用，当前版本没有可回滚的上一版"
  fi
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

get_container_state() {
  docker inspect --format '{{.State.Status}}' "$1" 2>/dev/null || true
}

get_container_health() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || true
}

get_container_restart_count() {
  docker inspect --format '{{.RestartCount}}' "$1" 2>/dev/null || echo "0"
}

get_container_project_label() {
  docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null || true
}

cleanup_residual_container() {
  local container_name="${1:-}"
  if [ -z "$container_name" ]; then
    return
  fi

  if container_exists "$container_name"; then
    local project_label
    project_label=$(get_container_project_label "$container_name")
    if [ -z "$project_label" ]; then
      die "检测到残留容器 ${container_name} 但缺少 compose 标签，无法安全自动清理，请手动处理后再部署"
    fi
    if [ "$project_label" != "$COMPOSE_PROJECT_NAME_EFFECTIVE" ]; then
      die "检测到残留容器 ${container_name} 属于其他项目(${project_label})，无法自动清理，请手动处理后再部署"
    fi
    log "检测到残留容器 ${container_name}，执行清理"
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi
}

wait_for_container_running() {
  local container_name="${1:-}"
  local timeout_seconds="${2:-120}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    if container_exists "$container_name"; then
      local state
      state=$(get_container_state "$container_name")
      if [ "$state" = "running" ]; then
        return 0
      fi
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

wait_for_container_healthy() {
  local container_name="${1:-}"
  local timeout_seconds="${2:-120}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    if container_exists "$container_name"; then
      local health
      health=$(get_container_health "$container_name")
      if [ "$health" = "healthy" ]; then
        return 0
      fi
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

check_http_response() {
  local url="${1:-}"
  local expect_status="${2:-200}"
  local expect_content_type="${3:-}"
  local body_expectation="${4:-}"
  local label="${5:-$url}"
  local tmp_body tmp_headers status_code content_type
  local max_retries="${SMOKE_HTTP_RETRY:-6}"
  local retry_delay="${SMOKE_HTTP_RETRY_DELAY:-3}"
  local attempt=1

  while [ "$attempt" -le "$max_retries" ]; do
    tmp_body=$(mktemp)
    tmp_headers=$(mktemp)

    if curl -fsS --max-time 10 -D "$tmp_headers" -o "$tmp_body" "$url" >/dev/null 2>&1; then
      status_code=$(awk 'toupper($1) ~ /^HTTP/ { code=$2 } END { print code }' "$tmp_headers")
      content_type=$(awk -F': ' 'tolower($1)=="content-type" {print tolower($2)}' "$tmp_headers" | tail -1 | tr -d '\r')

      if [ "$status_code" != "$expect_status" ]; then
        log "❌ ${label} 状态码异常: expected=${expect_status}, actual=${status_code:-unknown}"
      elif [ -n "$expect_content_type" ] && [[ "$content_type" != *"$expect_content_type"* ]]; then
        log "❌ ${label} content-type 异常: expected~=${expect_content_type}, actual=${content_type:-empty}"
      elif [ -n "$body_expectation" ] && ! grep -q "$body_expectation" "$tmp_body"; then
        log "❌ ${label} body 未命中预期片段: ${body_expectation}"
      else
        rm -f "$tmp_body" "$tmp_headers"
        return 0
      fi
    else
      log "⚠️  ${label} 请求失败: ${url}"
    fi

    rm -f "$tmp_body" "$tmp_headers"
    if [ "$attempt" -lt "$max_retries" ]; then
      log "⏳ ${label} 重试中 (${attempt}/${max_retries})，等待 ${retry_delay}s"
      sleep "$retry_delay"
    fi
    attempt=$((attempt + 1))
  done

  log "❌ ${label} 请求失败（已重试 ${max_retries} 次）: ${url}"
  return 1
}

normalize_public_web_url() {
  local url="${1:-}"
  if [ -z "$url" ]; then
    return 1
  fi
  printf '%s' "${url%/}"
}

has_cloudflare_auth_configured() {
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    return 0
  fi

  if [ -n "${CLOUDFLARE_AUTH_EMAIL:-}" ] && [ -n "${CLOUDFLARE_GLOBAL_API_KEY:-}" ]; then
    return 0
  fi

  return 1
}

run_cloudflare_purge_script() {
  local purge_script="${1:-}"
  shift || true

  if [ -z "$purge_script" ]; then
    log "❌ 未提供 Cloudflare purge 脚本路径"
    return 1
  fi

  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID}" \
    CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}" \
      bash "$purge_script" "$@"
    return $?
  fi

  if [ -n "${CLOUDFLARE_AUTH_EMAIL:-}" ] && [ -n "${CLOUDFLARE_GLOBAL_API_KEY:-}" ]; then
    CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID}" \
    CLOUDFLARE_AUTH_EMAIL="${CLOUDFLARE_AUTH_EMAIL}" \
    CLOUDFLARE_GLOBAL_API_KEY="${CLOUDFLARE_GLOBAL_API_KEY}" \
      bash "$purge_script" "$@"
    return $?
  fi

  log "❌ 缺少 Cloudflare 认证信息：请提供 CLOUDFLARE_API_TOKEN，或同时提供 CLOUDFLARE_AUTH_EMAIL + CLOUDFLARE_GLOBAL_API_KEY"
  return 1
}

extract_entry_assets_from_html() {
  grep -o 'assets/[^"[:space:]]*' | sort -u
}

collect_entry_assets_from_url() {
  local url="${1:-}"
  if [ -z "$url" ]; then
    return 1
  fi
  curl -fsSL --max-time 15 "$url" | extract_entry_assets_from_html
}

verify_public_entry_sync_once() {
  if [ "${PUBLIC_WEB_URL:-off}" = "off" ]; then
    log "已跳过公网入口一致性检查（PUBLIC_WEB_URL=off）"
    return 0
  fi

  local normalized_public_url normalized_source_url source_assets public_assets
  normalized_public_url="$(normalize_public_web_url "$PUBLIC_WEB_URL")" || {
    log "❌ 无法解析 PUBLIC_WEB_URL：${PUBLIC_WEB_URL}"
    return 1
  }
  normalized_source_url="$(normalize_public_web_url "$PUBLIC_ENTRY_SYNC_SOURCE_URL")" || {
    log "❌ 无法解析 PUBLIC_ENTRY_SYNC_SOURCE_URL：${PUBLIC_ENTRY_SYNC_SOURCE_URL}"
    return 1
  }

  source_assets="$(collect_entry_assets_from_url "${normalized_source_url}/")" || {
    log "❌ 无法读取参考入口资源列表：${normalized_source_url}/"
    return 1
  }
  public_assets="$(collect_entry_assets_from_url "${normalized_public_url}/")" || {
    log "❌ 无法读取公网首页入口资源列表：${normalized_public_url}/"
    return 1
  }

  if [ -z "$source_assets" ] || [ -z "$public_assets" ]; then
    log "❌ 入口资源列表为空，无法判定公网/参考入口是否一致"
    log "  - source(${normalized_source_url}/): ${source_assets:-<empty>}"
    log "  - public: ${public_assets:-<empty>}"
    return 1
  fi

  if [ "$source_assets" != "$public_assets" ]; then
    log "❌ 公网入口资源仍与参考入口不一致"
    log "  - source (${normalized_source_url}/):"
    while IFS= read -r line; do
      [ -n "$line" ] && log "    ${line}"
    done <<< "$source_assets"
    log "  - public (${normalized_public_url}/):"
    while IFS= read -r line; do
      [ -n "$line" ] && log "    ${line}"
    done <<< "$public_assets"
    return 1
  fi

  log "✅ 公网入口资源已与参考入口一致"
  return 0
}

verify_public_entry_sync_with_retry() {
  local attempts="${PUBLIC_ENTRY_SYNC_RETRY:-4}"
  local delay_seconds="${PUBLIC_ENTRY_SYNC_DELAY:-5}"
  local attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if verify_public_entry_sync_once; then
      return 0
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      log "⏳ 等待公网入口同步 (${attempt}/${attempts})，${delay_seconds}s 后重试"
      sleep "$delay_seconds"
    fi
    attempt=$((attempt + 1))
  done

  return 1
}

purge_cloudflare_cache_if_configured() {
  local normalized_public_url mode purge_script
  normalized_public_url="$(normalize_public_web_url "$PUBLIC_WEB_URL" 2>/dev/null || true)"
  purge_script="${DEPLOY_SCRIPT_DIR}/purge-cloudflare-cache.sh"

  if [ ! -x "$purge_script" ] && [ -f "$purge_script" ]; then
    chmod +x "$purge_script" || true
  fi

  mode="${CLOUDFLARE_PURGE_MODE:-auto}"
  if [ "$mode" = "auto" ]; then
    if [ -n "${CLOUDFLARE_ZONE_ID:-}" ] && has_cloudflare_auth_configured; then
      mode="everything"
    else
      mode="skip"
    fi
  fi

  case "$mode" in
    skip|off)
      log "跳过 Cloudflare purge（CLOUDFLARE_PURGE_MODE=${mode}）"
      return 0
      ;;
    everything)
      ;;
    files)
      ;;
    *)
      log "❌ 未知 CLOUDFLARE_PURGE_MODE=${mode}"
      return 1
      ;;
  esac

  if [ -z "${CLOUDFLARE_ZONE_ID:-}" ] || ! has_cloudflare_auth_configured; then
    log "❌ 已要求 Cloudflare purge，但缺少 CLOUDFLARE_ZONE_ID 或 Cloudflare 认证信息"
    return 1
  fi

  if [ ! -f "$purge_script" ]; then
    log "❌ 缺少 purge 脚本：${purge_script}"
    return 1
  fi

  if [ "$mode" = "everything" ]; then
    log "执行 Cloudflare 全量 purge"
    run_cloudflare_purge_script "$purge_script" everything
    return $?
  fi

  if [ -z "$normalized_public_url" ]; then
    log "❌ files 模式缺少有效 PUBLIC_WEB_URL"
    return 1
  fi

  local -a files_to_purge=("${normalized_public_url}/" "${normalized_public_url}/index.html")
  while IFS= read -r asset; do
    [ -n "$asset" ] && files_to_purge+=("${normalized_public_url}/${asset}")
  done < <(collect_entry_assets_from_url "${PUBLIC_ENTRY_SYNC_SOURCE_URL}" || true)

  log "执行 Cloudflare 定向 purge，共 ${#files_to_purge[@]} 个 URL"
  run_cloudflare_purge_script "$purge_script" files "${files_to_purge[@]}"
}

run_public_entry_sync_gate() {
  if [ "${PUBLIC_WEB_URL:-off}" = "off" ]; then
    log "已跳过公网入口一致性门禁（PUBLIC_WEB_URL=off）"
    return 0
  fi

  if ! purge_cloudflare_cache_if_configured; then
    log "❌ Cloudflare purge 失败，无法继续验证公网入口是否已切到新版本"
    return 1
  fi

  if verify_public_entry_sync_with_retry; then
    return 0
  fi

  if [ "${REQUIRE_PUBLIC_ENTRY_SYNC:-1}" = "1" ]; then
    log "❌ 公网入口仍未与参考入口一致，拒绝把本次部署视为完成"
    return 1
  fi

  log "⚠️ 公网入口仍未与参考入口一致，但 REQUIRE_PUBLIC_ENTRY_SYNC=${REQUIRE_PUBLIC_ENTRY_SYNC}，仅警告"
  return 0
}

run_post_deploy_smoke() {
  local phase="${1:-deploy}"

  log "开始执行 post-deploy smoke（phase=${phase}）"

  if ! wait_for_container_healthy "$MONGODB_CONTAINER_NAME" 120; then
    log "❌ mongodb 在超时内未进入 healthy"
    return 1
  fi
  if ! wait_for_container_running "$GAME_CONTAINER_NAME" 120; then
    log "❌ game-server 在超时内未进入 running"
    return 1
  fi
  if ! wait_for_container_running "$WEB_CONTAINER_NAME" 120; then
    log "❌ web 在超时内未进入 running"
    return 1
  fi

  local web_restart_count game_restart_count
  web_restart_count=$(get_container_restart_count "$WEB_CONTAINER_NAME")
  game_restart_count=$(get_container_restart_count "$GAME_CONTAINER_NAME")
  if [ "${web_restart_count:-0}" -gt 0 ]; then
    log "❌ web 检测到异常重启: restartCount=${web_restart_count}"
    return 1
  fi
  if [ "${game_restart_count:-0}" -gt 0 ]; then
    log "❌ game-server 检测到异常重启: restartCount=${game_restart_count}"
    return 1
  fi

  check_http_response "http://127.0.0.1/" "200" "text/html" "<html" "首页探活" || return 1
  check_http_response "http://127.0.0.1/health" "200" "application/json" '"status"[[:space:]]*:[[:space:]]*"ok"' "health 探活" || return 1
  check_http_response "http://127.0.0.1/notifications" "200" "application/json" '"notifications"' "notifications 探活" || return 1

  log "✅ post-deploy smoke 通过（phase=${phase}）"
  return 0
}

rollback_to_snapshot() {
  if [ "$ROLLBACK_READY" != "1" ]; then
    log "❌ 未找到可用的部署前镜像快照，无法自动回退"
    return 1
  fi

  log "开始自动回退到部署前镜像引用"
  log "  - web: ${PREVIOUS_WEB_IMAGE_REF}"
  log "  - game-server: ${PREVIOUS_GAME_IMAGE_REF}"

  set_compose_image_refs "$PREVIOUS_GAME_IMAGE_REF" "$PREVIOUS_WEB_IMAGE_REF"

  log "拉取回退镜像（如本地缺失）"
  docker compose -f "$COMPOSE_FILE" pull "${APP_SERVICES[@]}" || true

  log "启动回退后的服务"
  docker compose -f "$COMPOSE_FILE" up -d

  if ! run_post_deploy_smoke "rollback"; then
    log "❌ 自动回退后的 smoke 仍失败"
    return 1
  fi

  log "✅ 自动回退成功，服务已恢复到部署前版本"
  return 0
}

generate_jwt_secret() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  else
    date +%s | sha256sum | awk '{print $1}'
  fi
}

# ============================================================
# .env 配置向导
# ============================================================

prompt_env_interactive() {
  echo ""
  echo "=========================================="
  echo "  🎲 桌游平台 - 环境配置向导"
  echo "=========================================="
  echo ""

  # --- JWT_SECRET ---
  local jwt_secret
  echo -n "${LOG_PREFIX} JWT_SECRET（回车自动生成安全密钥）："
  read -r jwt_secret || jwt_secret=""
  if [ -z "$jwt_secret" ]; then
    jwt_secret="$(generate_jwt_secret)"
    log "✅ 已自动生成 JWT_SECRET"
  fi

  # --- SMTP（可选） ---
  local smtp_host="" smtp_port="" smtp_user="" smtp_pass=""
  echo ""
  echo "${LOG_PREFIX} SMTP 邮件服务用于邮箱验证码功能（可选）。"
  echo -n "${LOG_PREFIX} 是否配置 SMTP？[y/N] "
  local smtp_choice
  read -r smtp_choice || smtp_choice="n"
  if [[ "$smtp_choice" =~ ^[yY] ]]; then
    echo -n "${LOG_PREFIX}   SMTP_HOST（如 smtp.qq.com）："
    read -r smtp_host || smtp_host=""
    echo -n "${LOG_PREFIX}   SMTP_PORT（如 465）："
    read -r smtp_port || smtp_port=""
    echo -n "${LOG_PREFIX}   SMTP_USER（发件邮箱）："
    read -r smtp_user || smtp_user=""
    echo -n "${LOG_PREFIX}   SMTP_PASS（授权码，非密码）："
    read -r smtp_pass || smtp_pass=""
  else
    log "跳过 SMTP 配置（邮箱验证码功能不可用）"
  fi

  # --- 管理员账号（可选） ---
  local admin_email="" admin_password="" admin_username=""
  echo ""
  echo "${LOG_PREFIX} 管理员账号用于后台管理功能（可选，部署后也可手动创建）。"
  echo -n "${LOG_PREFIX} 是否配置管理员账号？[y/N] "
  local admin_choice
  read -r admin_choice || admin_choice="n"
  if [[ "$admin_choice" =~ ^[yY] ]]; then
    echo -n "${LOG_PREFIX}   管理员邮箱："
    read -r admin_email || admin_email=""
    echo -n "${LOG_PREFIX}   管理员密码："
    read -rs admin_password || admin_password=""
    echo ""
    echo -n "${LOG_PREFIX}   管理员昵称（回车默认"管理员"）："
    read -r admin_username || admin_username=""
    if [ -z "$admin_username" ]; then
      admin_username="管理员"
    fi
  else
    log "跳过管理员配置（部署后可运行 bash deploy-image.sh init-admin 创建）"
  fi

  # --- SENTRY_DSN（可选） ---
  local sentry_dsn=""
  echo ""
  echo -n "${LOG_PREFIX} Sentry DSN（错误监控，可选，回车跳过）："
  read -r sentry_dsn || sentry_dsn=""

  # --- 写入 .env ---
  cat > .env << EOF
# ===== 密钥（必填） =====
JWT_SECRET=${jwt_secret}
EOF

  if [ -n "$admin_email" ]; then
    cat >> .env << EOF

# ===== 管理员账号（首次启动自动创建） =====
ADMIN_EMAIL=${admin_email}
ADMIN_PASSWORD=${admin_password}
ADMIN_USERNAME=${admin_username}
EOF
  fi

  if [ -n "$smtp_host" ]; then
    cat >> .env << EOF

# ===== 邮件服务（可选） =====
SMTP_HOST=${smtp_host}
SMTP_PORT=${smtp_port}
SMTP_USER=${smtp_user}
SMTP_PASS=${smtp_pass}
EOF
  fi

  if [ -n "$sentry_dsn" ]; then
    cat >> .env << EOF

# ===== 错误监控（可选） =====
SENTRY_DSN=${sentry_dsn}
EOF
  fi

  cat >> .env << EOF

# ===== 以下由 docker-compose.prod.yml 自动覆盖，无需修改 =====
# MONGO_URI / REDIS_HOST / REDIS_PORT / GAME_SERVER_PORT / API_SERVER_PORT
EOF

  echo ""
  log "✅ .env 已生成"
  log "如需修改，直接编辑 .env 文件即可"
}

ensure_env_file() {
  if [ -f ".env" ]; then
    log "检测到 .env，跳过生成"
    return
  fi

  if [ -f ".env.server" ]; then
    log "检测到 .env.server，执行生成 .env"
    bash .env.server "$(pwd)"
    return
  fi

  if [ -t 0 ]; then
    prompt_env_interactive
    return
  fi

  # 非交互环境
  log "非交互终端，自动生成最小 .env"
  local jwt_secret="${JWT_SECRET:-$(generate_jwt_secret)}"

  cat > .env << EOF
# 自动生成 — 请检查并按需修改
JWT_SECRET=${jwt_secret}
EOF

  log "⚠️  .env 已自动生成，建议检查配置"
}

# ============================================================
# 端口冲突检测与清理
# ============================================================

ensure_port_available() {
  local port=80

  # 检查是否有进程占用 80 端口
  if command -v ss &>/dev/null; then
    local pid
    pid=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K\d+' | head -1 || true)
    if [ -n "$pid" ]; then
      local proc_name
      proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
      log "⚠️  端口 ${port} 被占用（PID=${pid}, ${proc_name}）"

      # 如果是 Nginx，停止并禁用它
      if [[ "$proc_name" == "nginx" ]]; then
        log "检测到宿主机 Nginx 占用 80 端口，正在停止..."
        $SUDO systemctl stop nginx 2>/dev/null || true
        $SUDO systemctl disable nginx 2>/dev/null || true
        log "✅ 已停止并禁用宿主机 Nginx（不再需要，web 容器直接监听 80）"
      elif [[ "$proc_name" == "docker-proxy" ]] && docker container inspect "$WEB_CONTAINER_NAME" >/dev/null 2>&1; then
        log "检测到当前 web 容器正在占用 80 端口，允许继续更新部署"
      else
        die "端口 ${port} 被 ${proc_name}(PID=${pid}) 占用，请先释放"
      fi
    fi
  fi
}

# ============================================================
# 管理员初始化
# ============================================================

init_admin_if_configured() {
  # 从 .env 读取管理员配置
  local admin_email admin_password admin_username
  admin_email=$(grep -E '^ADMIN_EMAIL=' .env 2>/dev/null | cut -d= -f2- || true)
  admin_password=$(grep -E '^ADMIN_PASSWORD=' .env 2>/dev/null | cut -d= -f2- || true)
  admin_username=$(grep -E '^ADMIN_USERNAME=' .env 2>/dev/null | cut -d= -f2- || true)

  if [ -z "$admin_email" ] || [ -z "$admin_password" ]; then
    return
  fi

  log "检测到管理员配置，等待 web 容器就绪..."

  # 等待 web 容器启动（最多 30 秒）
  local retries=0
  while [ $retries -lt 15 ]; do
    if docker compose -f "$COMPOSE_FILE" exec -T web echo "ready" &>/dev/null; then
      break
    fi
    sleep 2
    retries=$((retries + 1))
  done

  if [ $retries -ge 15 ]; then
    log "⚠️  web 容器未就绪，跳过管理员初始化（可稍后运行 bash deploy-image.sh init-admin）"
    return
  fi

  log "初始化管理员账号..."
  if docker compose -f "$COMPOSE_FILE" exec -T -e NODE_ENV=development web \
    npx tsx --tsconfig tsconfig.api.json scripts/db/init_admin.ts \
      --email="$admin_email" \
      --password="$admin_password" \
      --username="${admin_username:-管理员}" \
      --actor="deploy-script"; then
    log "✅ 管理员账号初始化完成"
  else
    log "⚠️  管理员初始化失败（可稍后运行 bash deploy-image.sh init-admin 重试）"
  fi
}

init_admin() {
  ensure_compose_file

  # 优先从 .env 读取
  local admin_email admin_password admin_username
  local need_save=false
  admin_email=$(grep -E '^ADMIN_EMAIL=' .env 2>/dev/null | cut -d= -f2- || true)
  admin_password=$(grep -E '^ADMIN_PASSWORD=' .env 2>/dev/null | cut -d= -f2- || true)
  admin_username=$(grep -E '^ADMIN_USERNAME=' .env 2>/dev/null | cut -d= -f2- || true)

  if [ -z "$admin_email" ] || [ -z "$admin_password" ]; then
    # 交互式输入
    if [ -t 0 ]; then
      echo -n "${LOG_PREFIX} 管理员邮箱："
      read -r admin_email || admin_email=""
      echo -n "${LOG_PREFIX} 管理员密码："
      read -rs admin_password || admin_password=""
      echo ""
      echo -n "${LOG_PREFIX} 管理员昵称（回车默认"管理员"）："
      read -r admin_username || admin_username=""
      need_save=true
    fi
  fi

  if [ -z "$admin_email" ] || [ -z "$admin_password" ]; then
    die "缺少管理员邮箱或密码。请在 .env 中配置 ADMIN_EMAIL/ADMIN_PASSWORD，或交互式输入"
  fi

  admin_username="${admin_username:-管理员}"

  log "初始化管理员账号..."
  docker compose -f "$COMPOSE_FILE" exec -T -e NODE_ENV=development web \
    npx tsx --tsconfig tsconfig.api.json scripts/db/init_admin.ts \
      --email="$admin_email" \
      --password="$admin_password" \
      --username="$admin_username" \
      --actor="deploy-script"

  log "✅ 管理员账号初始化完成"

  # 交互式输入的配置写回 .env，下次无需重复输入
  if [ "$need_save" = true ] && [ -f ".env" ]; then
    # 移除已有的 ADMIN_ 行（如果有残留注释等）
    sed -i '/^#.*管理员账号/d; /^ADMIN_EMAIL=/d; /^ADMIN_PASSWORD=/d; /^ADMIN_USERNAME=/d' .env
    cat >> .env << EOF

# ===== 管理员账号 =====
ADMIN_EMAIL=${admin_email}
ADMIN_PASSWORD=${admin_password}
ADMIN_USERNAME=${admin_username}
EOF
    log "✅ 管理员配置已写入 .env"
  fi
}

# ============================================================
# 部署操作
# ============================================================

deploy() {
  local tag="${1:-latest}"
  local image_source="${2:-remote}"
  ensure_compose_file
  ensure_env_file
  check_docker_mirror_config
  ensure_port_available
  snapshot_current_runtime_refs
  set_compose_image_tag "$tag"

  # 清理旧镜像和构建缓存（在拉取新镜像之前）
  log "清理旧镜像和构建缓存"
  docker image prune -f > /dev/null 2>&1 || true
  docker builder prune -f > /dev/null 2>&1 || true

  if [ "$image_source" = "local" ]; then
    log "使用服务器本地已存在镜像（tag: ${tag}）"
  else
    log "拉取镜像（tag: ${tag}）"
  fi
  pull_app_images "$image_source"

  log "停止旧服务"
  if ! docker compose -f "$COMPOSE_FILE" down --remove-orphans; then
    log "⚠️  docker compose down 执行失败，继续尝试清理残留容器"
  fi

  cleanup_residual_container "$MONGODB_CONTAINER_NAME"
  cleanup_residual_container "$REDIS_CONTAINER_NAME"
  cleanup_residual_container "$GAME_CONTAINER_NAME"
  cleanup_residual_container "$WEB_CONTAINER_NAME"

  log "启动服务"
  if ! docker compose -f "$COMPOSE_FILE" up -d; then
    log "❌ 新版本容器启动失败，准备自动回退"
    if rollback_to_snapshot; then
      die "新版本容器启动失败，已自动回退到部署前版本"
    fi
    die "新版本容器启动失败，且自动回退失败，请立即执行 status/logs 排障"
  fi

  # 清理停止的容器和未使用的网络（在启动新服务之后）
  log "清理停止的容器和未使用的网络"
  docker container prune -f > /dev/null 2>&1 || true
  docker network prune -f > /dev/null 2>&1 || true

  if ! run_post_deploy_smoke "deploy"; then
    log "❌ 新版本部署后的 smoke 失败，准备自动回退"
    if rollback_to_snapshot; then
      die "新版本部署 smoke 失败，已自动回退到部署前版本"
    fi
    die "新版本部署 smoke 失败，且自动回退失败，请立即执行 status/logs 排障"
  fi

  # 等待服务就绪后初始化管理员
  init_admin_if_configured

  if ! run_public_entry_sync_gate; then
    die "参考入口与公网入口资源仍未收敛到同一版本；请检查 Cloudflare / Pages / DNS 发布链并重试"
  fi

  record_successful_runtime_state "deploy" || true

  echo ""
  log "=========================================="
  log "  ✅ 部署完成"
  log "=========================================="
  docker compose -f "$COMPOSE_FILE" ps
  echo ""
  log "架构: Cloudflare (HTTPS + CDN) → 服务器 :80 → web 容器 (NestJS) → game-server (内部)"
  log ""
  log "部署后配置 Cloudflare："
  log "  1. DNS: 域名 A 记录 → 服务器 IP（开启代理/橙色云朵）"
  log "  2. SSL/TLS: 模式选 Flexible（源站 HTTP）"
  log "  3. 不需要 api 子域名，前后端同域，无 CORS"
}

rollback() {
  local tag="${1:-}"
  if [ -z "$tag" ]; then
    die "请指定要回滚的版本 tag，例如：bash deploy-image.sh rollback v1.2.3"
  fi

  ensure_compose_file
  snapshot_current_runtime_refs

  log "回滚到版本 ${tag}"

  set_compose_image_tag "$tag"

  log "拉取指定版本镜像"
  pull_app_images

  log "重启服务"
  docker compose -f "$COMPOSE_FILE" up -d

  if ! run_post_deploy_smoke "manual-rollback"; then
    die "手动回退后的 smoke 失败，请立即检查日志"
  fi

  if ! run_public_entry_sync_gate; then
    die "回退后的参考入口与公网入口资源仍未收敛到同一版本；请检查 Cloudflare / Pages / DNS 发布链并重试"
  fi

  record_successful_runtime_state "rollback-tag" || true

  log "回滚完成"
  docker compose -f "$COMPOSE_FILE" ps
}

rollback_last() {
  ensure_compose_file
  load_deploy_state

  log "回滚到上次成功部署版本"
  log "  - 当前记录 web: ${DEPLOY_STATE_CURRENT_WEB_IMAGE_REF}"
  log "  - 当前记录 game-server: ${DEPLOY_STATE_CURRENT_GAME_IMAGE_REF}"
  log "  - 目标回滚 web: ${DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF}"
  log "  - 目标回滚 game-server: ${DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF}"

  set_compose_image_refs "$DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF" "$DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF"

  log "拉取上次部署镜像（如本地缺失）"
  docker compose -f "$COMPOSE_FILE" pull "${APP_SERVICES[@]}" || true

  log "重启服务"
  docker compose -f "$COMPOSE_FILE" up -d

  if ! run_post_deploy_smoke "manual-rollback-last"; then
    die "回滚到上次部署后的 smoke 失败，请立即检查日志"
  fi

  if ! run_public_entry_sync_gate; then
    die "回退后的参考入口与公网入口资源仍未收敛到同一版本；请检查 Cloudflare / Pages / DNS 发布链并重试"
  fi

  write_deploy_state \
    "$DEPLOY_STATE_CURRENT_WEB_IMAGE_REF" \
    "$DEPLOY_STATE_CURRENT_GAME_IMAGE_REF" \
    "$DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF" \
    "$DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF" \
    "rollback-last"

  log "✅ 已更新部署状态到 ${DEPLOY_STATE_FILE}"
  log "回滚到上次部署完成"
  docker compose -f "$COMPOSE_FILE" ps
}

status() {
  ensure_compose_file
  docker compose -f "$COMPOSE_FILE" ps
}

logs() {
  ensure_compose_file
  docker compose -f "$COMPOSE_FILE" logs -f "${1:-}"
}

ensure_local_target_image() {
  local image_ref="${1:-}"
  if [ -z "$image_ref" ]; then
    die "本地镜像检查缺少镜像引用"
  fi

  if ! docker image inspect "$image_ref" >/dev/null 2>&1; then
    die "目标镜像未在本地就绪：${image_ref}。请先导入镜像，再执行 update-local"
  fi
}

pull_image_ref() {
  local image_ref="${1:-}"
  local timeout_seconds="${DEPLOY_IMAGE_PULL_TIMEOUT_SECONDS:-1800}"
  local pull_status=0

  if [ -z "$image_ref" ]; then
    die "拉取镜像缺少镜像引用"
  fi

  if ! [[ "$timeout_seconds" =~ ^[0-9]+$ ]]; then
    die "DEPLOY_IMAGE_PULL_TIMEOUT_SECONDS 必须是非负整数秒：${timeout_seconds}"
  fi

  if [ "$timeout_seconds" -eq 0 ] || ! command -v timeout >/dev/null 2>&1; then
    docker pull "$image_ref"
    return
  fi

  timeout "${timeout_seconds}s" docker pull "$image_ref" || pull_status=$?
  if [ "$pull_status" -eq 124 ]; then
    die "拉取镜像超时（${timeout_seconds}s）：${image_ref}"
  fi
  if [ "$pull_status" -ne 0 ]; then
    die "拉取镜像失败（exit=${pull_status}）：${image_ref}"
  fi
}

pull_app_images() {
  local image_source="${1:-remote}"
  if [ -z "$TARGET_GAME_IMAGE_REF" ] || [ -z "$TARGET_WEB_IMAGE_REF" ]; then
    die "未锁定目标应用镜像引用，无法执行定向拉取"
  fi

  if [ "$image_source" = "local" ]; then
    log "跳过远端拉取，检查服务器本地目标镜像"
    log "  - game-server: ${TARGET_GAME_IMAGE_REF}"
    log "  - web: ${TARGET_WEB_IMAGE_REF}"
    ensure_local_target_image "$TARGET_GAME_IMAGE_REF"
    ensure_local_target_image "$TARGET_WEB_IMAGE_REF"
    return 0
  fi

  log "拉取应用镜像引用"
  log "  - game-server: ${TARGET_GAME_IMAGE_REF}"
  log "  - web: ${TARGET_WEB_IMAGE_REF}"
  pull_image_ref "$TARGET_GAME_IMAGE_REF"
  pull_image_ref "$TARGET_WEB_IMAGE_REF"
}

# ============================================================
# 主入口
# ============================================================

case "${1:-deploy}" in
  deploy|update)
    deploy "${2:-latest}" "remote"
    ;;
  deploy-local|update-local)
    deploy "${2:-latest}" "local"
    ;;
  rollback)
    rollback "${2:-}"
    ;;
  rollback-last)
    rollback_last
    ;;
  configure-mirror)
    configure_docker_mirror
    ;;
  init-admin)
    init_admin
    ;;
  status)
    status
    ;;
  logs)
    logs "${2:-}"
    ;;
  *)
    echo "用法: $0 [deploy [tag]|update [tag]|deploy-local [tag]|update-local [tag]|rollback <tag>|rollback-last|configure-mirror|init-admin|status|logs [service]]"
    exit 1
    ;;
esac
