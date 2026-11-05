#!/usr/bin/env bash
# 服务器素材每周快照：主源仍在服务器，R2只保留独立备份，不反向同步。
set -euo pipefail

assets_root="${BG_ASSET_BACKUP_ROOT:-/home/admin/storage/assets}"
backup_remote="${BG_ASSET_BACKUP_REMOTE:-r2-boardgame:boardgame-assets/weekly-server-backups}"
snapshot_root="${assets_root}/weekly-backup-staging"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
snapshot="${snapshot_root}/${run_id}"
week_id="$(TZ=Asia/Shanghai date +%G-W%V)"

mkdir -p "${snapshot_root}"
exec 8>"${assets_root}/weekly-backup.lock"
flock -n 8 || exit 0

cleanup() {
    # 只移除本次新建的快照目录；硬链接解除不删除正式release中的对象。
    case "${snapshot}" in
        "${snapshot_root}/"*) rm -rf -- "${snapshot}" ;;
        *) exit 64 ;;
    esac
}
trap cleanup EXIT

(
    # 只在取不可变发布快照时持锁；网络备份期间不阻塞素材上传。
    flock -x 9
    source_release="$(readlink -f "${assets_root}/current")"
    mkdir "${snapshot}"
    cp -al "${source_release}/." "${snapshot}/"
    # 索引元数据单独复制，避免后续发布改写硬链接索引。
    for metadata in .boardgame-asset-index.json .boardgame-publish-manifest.json .active-release.json; do
        if [[ -f "${source_release}/${metadata}" ]]; then
            cp --remove-destination "${source_release}/${metadata}" "${snapshot}/${metadata}"
        fi
    done
    printf 'sourceRelease=%s\nbackupWeek=%s\n' "${source_release}" "${week_id}" >"${snapshot}/.weekly-backup-info"
) 9>"${assets_root}/publish.lock"

echo "assetWeeklyBackup=start week=${week_id} destination=${backup_remote}/${week_id}"
rclone copy "${snapshot}/" "${backup_remote}/${week_id}" \
    --transfers 4 --retries 3 --log-level INFO
echo "assetWeeklyBackup=completed week=${week_id}"
