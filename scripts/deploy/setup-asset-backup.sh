#!/usr/bin/env bash
set -euo pipefail

echo "[资源备份] setup-asset-backup.sh 已退役：当前生产资源链路只允许服务器主源发布和读取。"
echo "[资源备份] 不再配置对象存储同步、灾备 cron 或任何历史远端凭据。"
exit 1
