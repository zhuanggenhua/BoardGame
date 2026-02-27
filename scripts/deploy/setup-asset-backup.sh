#!/usr/bin/env bash
set -euo pipefail

# R2 资源备份设置脚本（服务器上运行一次即可）
#
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/scripts/deploy/setup-asset-backup.sh | bash
#
# 功能：
#   1. 安装 rclone（如未安装）
#   2. 配置 R2 远程存储
#   3. 设置 cron 每天自动同步到本地备份目录
#   4. 立即执行一次同步
#
# 备份目录：/opt/boardgame-assets-backup

LOG_PREFIX="[资源备份]"
BACKUP_DIR="/opt/boardgame-assets-backup"
RCLONE_REMOTE="r2-boardgame"
R2_BUCKET="boardgame-assets"

# R2 凭证（只读访问即可）
R2_ACCOUNT_ID="7c68c934b8012b36c8fccc36d4c2a78a"
R2_ACCESS_KEY_ID="e2be60a49cb1935751eec0f5be8674eb"
R2_SECRET_ACCESS_KEY="66b2098954aa77b4c3adafac857a7cc2f17f70ebe4f3caaf235991a7ef8fe321"

log() { echo "${LOG_PREFIX} $*"; }
die() { echo "${LOG_PREFIX} 错误: $*" >&2; exit 1; }

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
# 1. 安装 rclone
# ============================================================

install_rclone() {
  if command -v rclone &>/dev/null; then
    log "rclone 已安装: $(rclone version | head -1)"
    return
  fi

  log "安装 rclone..."
  curl -fsSL https://rclone.org/install.sh | $SUDO bash
  log "✅ rclone 安装完成: $(rclone version | head -1)"
}

# ============================================================
# 2. 配置 R2 远程
# ============================================================

configure_rclone() {
  local config_dir="${HOME}/.config/rclone"
  local config_file="${config_dir}/rclone.conf"

  # 检查是否已配置
  if [ -f "$config_file" ] && grep -q "\[${RCLONE_REMOTE}\]" "$config_file" 2>/dev/null; then
    log "rclone 远程 '${RCLONE_REMOTE}' 已配置，跳过"
    return
  fi

  mkdir -p "$config_dir"

  cat >> "$config_file" << EOF

[${RCLONE_REMOTE}]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
EOF

  log "✅ rclone 远程 '${RCLONE_REMOTE}' 配置完成"
}

# ============================================================
# 3. 设置 cron
# ============================================================

setup_cron() {
  local cron_cmd="rclone sync ${RCLONE_REMOTE}:${R2_BUCKET} ${BACKUP_DIR} --transfers 8 --log-file /var/log/boardgame-asset-backup.log --log-level INFO"
  local cron_entry="0 3 * * * ${cron_cmd}"

  # 检查是否已有
  if crontab -l 2>/dev/null | grep -q "boardgame-asset-backup"; then
    log "cron 任务已存在，跳过"
    return
  fi

  (crontab -l 2>/dev/null || true; echo "${cron_entry}") | crontab -
  log "✅ cron 已设置：每天凌晨 3 点自动同步"
}

# ============================================================
# 4. 首次同步
# ============================================================

first_sync() {
  $SUDO mkdir -p "$BACKUP_DIR"

  log "开始首次同步（可能需要几分钟）..."
  rclone sync "${RCLONE_REMOTE}:${R2_BUCKET}" "$BACKUP_DIR" \
    --transfers 8 \
    --progress \
    --stats 5s

  local count
  count=$(find "$BACKUP_DIR" -type f | wc -l)
  log "✅ 同步完成，共 ${count} 个文件"
}

# ============================================================
# 主流程
# ============================================================

main() {
  log "=========================================="
  log "  🗄️  R2 资源备份设置"
  log "=========================================="
  echo ""

  install_rclone
  configure_rclone
  setup_cron

  $SUDO mkdir -p "$BACKUP_DIR"

  echo ""
  log "是否立即执行首次同步？[Y/n]"
  if [ -t 0 ]; then
    local choice
    read -r choice || choice="y"
    if [[ ! "$choice" =~ ^[nN] ]]; then
      first_sync
    else
      log "跳过首次同步，cron 会在凌晨 3 点自动执行"
    fi
  else
    first_sync
  fi

  echo ""
  log "=========================================="
  log "  ✅ 设置完成"
  log "=========================================="
  log "备份目录: ${BACKUP_DIR}"
  log "同步频率: 每天凌晨 3:00"
  log "日志文件: /var/log/boardgame-asset-backup.log"
  log ""
  log "手动同步: rclone sync ${RCLONE_REMOTE}:${R2_BUCKET} ${BACKUP_DIR} --progress"
  log "查看状态: rclone size ${RCLONE_REMOTE}:${R2_BUCKET}"
}

main
