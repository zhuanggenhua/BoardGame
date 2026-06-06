#!/usr/bin/env bash
set -euo pipefail

LOG_PREFIX="[Cloudflare Purge]"

log() {
  echo "${LOG_PREFIX} $*"
}

die() {
  echo "${LOG_PREFIX} 错误: $*" >&2
  exit 1
}

if ! command -v curl >/dev/null 2>&1; then
  die "缺少 curl，无法调用 Cloudflare API"
fi

if [ -z "${CLOUDFLARE_ZONE_ID:-}" ]; then
  die "缺少 CLOUDFLARE_ZONE_ID"
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  die "缺少 CLOUDFLARE_API_TOKEN"
fi

MODE="${1:-everything}"
shift || true

build_payload() {
  case "$MODE" in
    everything)
      printf '%s' '{"purge_everything":true}'
      ;;
    files)
      if [ "$#" -eq 0 ]; then
        die "files 模式至少需要一个完整 URL"
      fi
      local payload='{"files":['
      local first='1'
      local file escaped
      for file in "$@"; do
        escaped="${file//\\/\\\\}"
        escaped="${escaped//\"/\\\"}"
        if [ "$first" = "0" ]; then
          payload+=','
        fi
        payload+="\"${escaped}\""
        first='0'
      done
      payload+=']}'
      printf '%s' "$payload"
      ;;
    *)
      die "未知模式：${MODE}（可用：everything | files）"
      ;;
  esac
}

payload="$(build_payload "$@")"

response="$(
  curl -fsS \
    -X POST \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${payload}"
)"

if ! printf '%s' "$response" | grep -q '"success":[[:space:]]*true'; then
  die "purge ${MODE} 失败: ${response}"
fi

log "✅ purge ${MODE} 成功: ${response}"
