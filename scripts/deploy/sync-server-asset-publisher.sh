#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
ssh_target="${BOARDGAME_DEPLOY_SSH_TARGET:-admin@8.148.71.102}"
ssh_key_path="${BOARDGAME_DEPLOY_SSH_KEY_PATH:-}"
known_hosts_path="${BOARDGAME_DEPLOY_SSH_KNOWN_HOSTS_PATH:-}"
run_id="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"

if [[ -z "${ssh_key_path}" || ! -f "${ssh_key_path}" ]]; then
    echo "asset publisher sync requires BOARDGAME_DEPLOY_SSH_KEY_PATH" >&2
    exit 1
fi
if [[ -z "${known_hosts_path}" || ! -f "${known_hosts_path}" ]]; then
    echo "asset publisher sync requires BOARDGAME_DEPLOY_SSH_KNOWN_HOSTS_PATH" >&2
    exit 1
fi
if [[ ! "${run_id}" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "asset publisher sync run id contains unsupported characters" >&2
    exit 1
fi

asset_files=(
    scripts/assets/apply-server-asset-publish.mjs
    scripts/assets/publish-primary-assets.mjs
    scripts/assets/active-server-assets.mjs
    scripts/assets/asset-publish-ownership.mjs
    scripts/assets/release-retention.mjs
    scripts/assets/server-android-package-refresh.mjs
    scripts/mobile/android-assets-base-url.mjs
)

for relative_path in "${asset_files[@]}"; do
    if [[ ! -f "${repo_root}/${relative_path}" ]]; then
        echo "missing asset publisher dependency: ${relative_path}" >&2
        exit 1
    fi
    node --check "${repo_root}/${relative_path}"
done

ssh_args=(
    -o BatchMode=yes
    -o ConnectTimeout=20
    -o ServerAliveInterval=20
    -o ServerAliveCountMax=3
    -o StrictHostKeyChecking=yes
    -o IdentitiesOnly=yes
    -i "${ssh_key_path}"
    -o "UserKnownHostsFile=${known_hosts_path}"
)
remote_stage="/tmp/boardgame-asset-publisher-${run_id}"
remote_archive="${remote_stage}/payload.tar.gz"
archive_path=""

cleanup() {
    if [[ -n "${archive_path}" ]]; then
        rm -f -- "${archive_path}"
    fi
}
trap cleanup EXIT

archive_path="$(mktemp)"
tar -czf "${archive_path}" -C "${repo_root}" "${asset_files[@]}"
ssh "${ssh_args[@]}" "${ssh_target}" "mkdir -m 700 -p '${remote_stage}'"
scp "${ssh_args[@]}" "${archive_path}" "${ssh_target}:${remote_archive}"

ssh "${ssh_args[@]}" "${ssh_target}" \
    "flock /home/admin/storage/assets/publish.lock bash -s -- '${remote_stage}' '${run_id}'" <<'REMOTE'
set -euo pipefail

remote_stage="$1"
run_id="$2"
payload="${remote_stage}/payload"
control_stage="${remote_stage}/control-runtime"
backup_root="/home/admin/storage/assets/publisher-backups/${run_id}"
assets_root="/home/admin/storage/assets"

case "${remote_stage}" in
    /tmp/boardgame-asset-publisher-*) ;;
    *) echo "invalid remote staging path" >&2; exit 64 ;;
esac
cleanup_remote_stage() {
    rm -rf -- "${remote_stage}"
}
trap cleanup_remote_stage EXIT

mkdir -p "${payload}" "${control_stage}/control" "${control_stage}/mobile"
tar -xzf "${remote_stage}/payload.tar.gz" -C "${payload}"

asset_names=(
    apply-server-asset-publish.mjs
    publish-primary-assets.mjs
    active-server-assets.mjs
    asset-publish-ownership.mjs
    release-retention.mjs
    server-android-package-refresh.mjs
)
for name in "${asset_names[@]}"; do
    cp -- "${payload}/scripts/assets/${name}" "${control_stage}/control/${name}"
done
cp -- "${payload}/scripts/mobile/android-assets-base-url.mjs" "${control_stage}/mobile/android-assets-base-url.mjs"

validate_runtime() {
    local assets_dir="$1"
    local mobile_dir="$2"
    local name
    for name in "${asset_names[@]}"; do
        node --check "${assets_dir}/${name}"
    done
    node --check "${mobile_dir}/android-assets-base-url.mjs"
    for name in publish-primary-assets.mjs active-server-assets.mjs asset-publish-ownership.mjs release-retention.mjs server-android-package-refresh.mjs; do
        node --input-type=module --eval 'await import(process.argv[1])' "file://${assets_dir}/${name}"
    done
}

validate_runtime "${payload}/scripts/assets" "${payload}/scripts/mobile"
validate_runtime "${control_stage}/control" "${control_stage}/mobile"

install_one() {
    local source="$1"
    local target="$2"
    local relative_backup_path="${target#/}"
    local backup_path="${backup_root}/${relative_backup_path}"
    local temporary_path="${target}.new.$$"

    mkdir -p "$(dirname "${target}")" "$(dirname "${backup_path}")"
    if [[ -e "${target}" || -L "${target}" ]]; then
        cp -a -- "${target}" "${backup_path}"
    fi
    install -m 0644 -- "${source}" "${temporary_path}"
    mv -f -- "${temporary_path}" "${target}"
}

for name in "${asset_names[@]}"; do
    install_one "${payload}/scripts/assets/${name}" "/home/admin/BoardGame/scripts/assets/${name}"
    install_one "${payload}/scripts/assets/${name}" "${assets_root}/control/${name}"
done
install_one "${payload}/scripts/mobile/android-assets-base-url.mjs" "/home/admin/BoardGame/scripts/mobile/android-assets-base-url.mjs"
install_one "${payload}/scripts/mobile/android-assets-base-url.mjs" "${assets_root}/mobile/android-assets-base-url.mjs"

validate_runtime "/home/admin/BoardGame/scripts/assets" "/home/admin/BoardGame/scripts/mobile"
validate_runtime "${assets_root}/control" "${assets_root}/mobile"
echo "assetPublisherSyncBackup=${backup_root}"
sha256sum \
    /home/admin/BoardGame/scripts/assets/apply-server-asset-publish.mjs \
    "${assets_root}/control/apply-server-asset-publish.mjs" \
    "${assets_root}/control/asset-publish-ownership.mjs"
REMOTE
