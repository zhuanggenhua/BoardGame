#!/usr/bin/env bash
set -euo pipefail

# 用法:
#   bash scripts/deploy/deploy-auto.sh
#
# 可选环境变量:
#   REPO_URL=https://github.com/zhuanggenhua/BoardGame.git
#   APP_DIR=BoardGame
#   JWT_SECRET=your-secret
#   MONGO_URI=mongodb://mongodb:27017/boardgame
#   WEB_ORIGINS=https://your-domain.com
#   MIRROR_PROVIDER=multi         # 默认使用多源 HTTPS 镜像
#   XUANYUAN_DOMAIN=docker.xuanyuan.me
#   CUSTOM_MIRRORS=https://xxx,https://yyy
#   SKIP_MIRROR=1        # 跳过镜像源配置
#   FORCE_ENV=1          # 强制覆盖 .env

LOG_PREFIX="[一键部署]"

log() {
  echo "${LOG_PREFIX} $*"
}

warn() {
  echo "${LOG_PREFIX} 警告: $*" >&2
}

die() {
  echo "${LOG_PREFIX} 错误: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if require_cmd sudo; then
    SUDO="sudo"
  else
    die "需要 root 或 sudo 权限"
  fi
fi

if [ ! -f /etc/os-release ]; then
  die "无法识别系统类型（缺少 /etc/os-release）"
fi

# shellcheck disable=SC1091
. /etc/os-release

OS_ID="${ID:-}"
OS_LIKE="${ID_LIKE:-}"
OS_FAMILY=""
PKG_MANAGER=""

case "$OS_ID" in
  ubuntu|debian)
    OS_FAMILY="debian"
    PKG_MANAGER="apt-get"
    ;;
  *)
    if echo "$OS_LIKE" | grep -qi "debian"; then
      OS_FAMILY="debian"
      PKG_MANAGER="apt-get"
    elif echo "$OS_LIKE" | grep -Eqi "rhel|fedora|centos" || [ "$OS_ID" = "alinux" ] || [ "$OS_ID" = "anolis" ]; then
      OS_FAMILY="rhel"
      if require_cmd dnf; then
        PKG_MANAGER="dnf"
      else
        PKG_MANAGER="yum"
      fi
    fi
    ;;
 esac

if [ -z "$OS_FAMILY" ] || [ -z "$PKG_MANAGER" ]; then
  die "当前系统未适配，请手动安装 Docker 与 docker compose"
fi

install_base_deps_debian() {
  log "安装基础依赖（apt）"
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg lsb-release git
}

install_base_deps_rhel() {
  log "安装基础依赖（${PKG_MANAGER}）"
  $SUDO "$PKG_MANAGER" install -y ca-certificates curl git
}

install_docker_debian() {
  if require_cmd docker; then
    log "Docker 已安装，跳过"
    return
  fi
  log "安装 Docker（Debian/Ubuntu）"
  $SUDO install -m 0755 -d /etc/apt/keyrings
  $SUDO rm -f /etc/apt/keyrings/docker.gpg
  curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS_ID} $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_rhel() {
  if require_cmd docker; then
    log "Docker 已安装，跳过"
    return
  fi
  log "安装 Docker（RHEL 系）"
  if require_cmd dnf; then
    $SUDO dnf install -y dnf-plugins-core
    $SUDO dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    $SUDO yum install -y yum-utils
    $SUDO yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    $SUDO yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
}

configure_docker_mirror() {
  if [ "${SKIP_MIRROR:-0}" = "1" ]; then
    log "已跳过镜像源配置"
    return
  fi

  log "配置 Docker 镜像源"
  $SUDO mkdir -p /etc/docker
  local daemon_file="/etc/docker/daemon.json"
  local mirror_provider="${MIRROR_PROVIDER:-multi}"
  local xuanyuan_domain="${XUANYUAN_DOMAIN:-docker.xuanyuan.me}"
  local custom_mirrors="${CUSTOM_MIRRORS:-}"
  local mirror_list=()

  xuanyuan_domain="${xuanyuan_domain#http://}"
  xuanyuan_domain="${xuanyuan_domain#https://}"

  if [ -n "$custom_mirrors" ]; then
    IFS=',' read -r -a mirror_list <<< "$custom_mirrors"
  elif [ "$mirror_provider" = "xuanyuan" ]; then
    mirror_list+=("https://${xuanyuan_domain}")
    if [ "$xuanyuan_domain" != "docker.xuanyuan.me" ]; then
      mirror_list+=("https://docker.xuanyuan.me")
    fi
    if echo "$xuanyuan_domain" | grep -q '\.xuanyuan\.run$'; then
      mirror_list+=("https://${xuanyuan_domain%.xuanyuan.run}.xuanyuan.dev")
    fi
  elif [ "$mirror_provider" = "multi" ]; then
    mirror_list+=(
      "https://mirror.aliyuncs.com"
      "https://docker.mirrors.ustc.edu.cn"
      "https://docker.mirrors.sjtug.sjtu.edu.cn"
      "https://docker.m.daocloud.io"
      "https://dockerproxy.com"
    )
  else
    mirror_list+=("https://registry.cn-hangzhou.aliyuncs.com" "https://docker.mirrors.ustc.edu.cn" "https://hub-mirror.c.163.com")
  fi

  local mirrors_json="["
  for mirror in "${mirror_list[@]}"; do
    mirror="${mirror// /}"
    [ -z "$mirror" ] && continue
    if [ "$mirrors_json" != "[" ]; then
      mirrors_json+=", "
    fi
    mirrors_json+="\"${mirror}\""
  done
  mirrors_json+="]"

  if [ -f "$daemon_file" ]; then
    $SUDO cp "$daemon_file" "${daemon_file}.bak.$(date +%s)"
  fi

  echo "{\"registry-mirrors\": ${mirrors_json}}" | $SUDO tee "$daemon_file" > /dev/null

  $SUDO systemctl daemon-reload
  $SUDO systemctl restart docker
}

ensure_docker_running() {
  $SUDO systemctl enable --now docker
  if ! $SUDO systemctl is-active --quiet docker; then
    die "Docker 启动失败，请检查 systemctl status docker"
  fi
}

resolve_docker_cmd() {
  if docker info >/dev/null 2>&1; then
    echo "docker"
  elif [ -n "$SUDO" ]; then
    echo "$SUDO docker"
  else
    die "当前用户无 Docker 权限"
  fi
}

prepare_repo() {
  local repo_url="${REPO_URL:-https://github.com/zhuanggenhua/BoardGame.git}"
  local app_dir="${APP_DIR:-BoardGame}"

  if [ -d "$app_dir/.git" ]; then
    log "仓库已存在，执行 git pull"
    git -C "$app_dir" pull --rebase
  else
    log "克隆仓库: ${repo_url}"
    git clone "$repo_url" "$app_dir"
  fi
}

prepare_env_file() {
  local app_dir="${APP_DIR:-BoardGame}"
  local env_file="$app_dir/.env"

  if [ -f "$env_file" ] && [ "${FORCE_ENV:-0}" != "1" ]; then
    log ".env 已存在，跳过生成"
    return
  fi

  local jwt_secret="${JWT_SECRET:-}"
  if [ -z "$jwt_secret" ]; then
    if require_cmd openssl; then
      jwt_secret=$(openssl rand -hex 32)
    else
      jwt_secret=$(date +%s | sha256sum | awk '{print $1}')
    fi
  fi

  local mongo_uri="${MONGO_URI:-mongodb://mongodb:27017/boardgame}"
  local web_origins="${WEB_ORIGINS:-}"

  if [ -z "$web_origins" ]; then
    local public_ip=""
    if require_cmd curl; then
      public_ip=$(curl -fsSL ifconfig.me || true)
    fi
    if [ -n "$public_ip" ]; then
      web_origins="http://${public_ip}"
    else
      web_origins="http://localhost"
    fi
  fi

  cat > "$env_file" <<EOF
JWT_SECRET=${jwt_secret}
MONGO_URI=${mongo_uri}
WEB_ORIGINS=${web_origins}
EOF

  log ".env 已生成（JWT_SECRET 已自动生成）"
}

main() {
  log "系统识别: ${OS_ID} (${OS_FAMILY})"

  if [ "$OS_FAMILY" = "debian" ]; then
    install_base_deps_debian
    install_docker_debian
  else
    install_base_deps_rhel
    install_docker_rhel
  fi

  ensure_docker_running
  configure_docker_mirror

  prepare_repo
  prepare_env_file

  local docker_cmd
  docker_cmd=$(resolve_docker_cmd)

  log "启动服务（docker compose）"
  (cd "${APP_DIR:-BoardGame}" && $docker_cmd compose up -d --build)

  log "部署完成"
  log "访问地址（临时）：http://<服务器公网IP>"
  log "如使用 Pages，请配置 VITE_BACKEND_URL=https://api.<你的域名>"
}

main
