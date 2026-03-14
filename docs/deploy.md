# 部署与运行（同域）

本项目默认采用**同域访问**，避免 CORS 与 WebSocket 跨域问题。

## 部署方式

使用 **镜像部署**：CI 预构建镜像 → 推送到镜像仓库 → 服务器拉取启动（< 1 分钟）

## 入口地址

- **开发**：`http://localhost:5173`
- **镜像部署**：`http://<服务器IP>`（端口 80）
- **Git 部署**：`http://<服务器IP>:3000`
- **Pages 预览域名**：`https://<project>.pages.dev`

## 镜像部署（推荐生产环境）

### 优势

- **部署快**：拉取预构建镜像，无需服务器编译
- **一致性高**：镜像已封装所有依赖，避免环境漂移
- **回滚简单**：切换镜像 tag 即可
- **服务器压力小**：无需 npm ci / build

### 前置要求

1. 服务器已安装 Docker + Docker Compose
2. GitHub Actions CI 已配置（自动构建并推送镜像）
3. 镜像仓库可访问（GHCR / 阿里云 ACR）

### 一键部署（推荐）

```bash
# 下载部署脚本并执行（交互式引导配置 .env）
curl -fsSL https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/scripts/deploy/deploy-image.sh -o deploy-image.sh
bash deploy-image.sh
```

脚本会自动完成：下载 compose 文件 → 引导生成 .env → 配置 Docker 镜像加速 → 安装/配置 Nginx → 拉取镜像 → 启动服务。

> **架构**：Cloudflare (HTTPS + CDN) → 服务器 80 端口 → Docker web 容器 (NestJS monolith) → 内部 game-server
> 无 Nginx，NestJS 直接监听 80 端口。Cloudflare 代理提供 SSL 和 CDN。

### 更新部署

```bash
bash deploy-image.sh update
bash deploy-image.sh update v1.2.3  # 部署指定 tag
```

### 回滚 / 状态 / 日志

```bash
bash deploy-image.sh rollback v1.2.3   # 回滚到指定版本
bash deploy-image.sh status             # 查看状态
bash deploy-image.sh logs [service]     # 查看日志
```

### 固定版本部署（推荐）

```bash
bash deploy-image.sh deploy v1.2.3  # 首次部署指定 tag
bash deploy-image.sh update v1.2.3  # 更新到指定 tag
```

- 不传 tag 时默认部署 `latest`
- 传入 tag 时，脚本会统一把 `game-server` 和 `web` 切到同一版本，便于排障与回滚
- 这些 tag 来自 GitHub Actions 发布的镜像标签（例如推送 Git tag `v1.2.3` 后生成对应镜像）

### CI 配置说明

镜像由 GitHub Actions 自动构建并推送到 GHCR（`.github/workflows/docker-publish.yml`）：

- **触发条件**：push 到 `main` 分支 或 创建 `v*` 标签
- **镜像地址**：
  - `ghcr.io/zhuanggenhua/boardgame-game:latest`
  - `ghcr.io/zhuanggenhua/boardgame-web:latest`
- **版本标签**：`latest`（main 分支）、`v1.2.3`（tag）、`sha-xxxxxx`（commit）

> **当前自动部署脚本的真实入口**：`boardgame-web` 是基于 `docker/Dockerfile.monolith` 构建的单体镜像，负责静态资源、`/auth`、`/notifications`、`/social-socket` 等 API / WebSocket 入口；`deploy-image.sh` 不会部署独立的 `auth-server`，也不会使用 `docker/Dockerfile.web` / `docker/nginx.conf` 作为生产主链路。

> **注意**：镜像构建由 GitHub Actions 自动完成，服务器脚本只负责拉取镜像。
> 私有镜像需要登录（脚本会提示是否登录 ghcr.io）。



## 部署前本地自检（强烈建议）

在发版前先在本机跑一遍“生产式”流程，能提前暴露构建/代理/端口问题。

```bash
# 1) 本地构建验证（等同于容器内 build）
npm run build

# 2) 构建镜像并启动（可加 --no-cache）
docker compose build --no-cache
docker compose up -d

# 3) 验证容器状态与入口
docker compose ps
curl -I http://127.0.0.1/
```

**注意**：浏览器侧的 WebSocket/接口应走同域入口：

- 正确：`http://127.0.0.1/` → `/lobby-socket`、`/games/*`
- 错误：直接访问 `http://127.0.0.1:18000`（该端口仅供容器内部使用）

如果你本地用 Vite 直连后端，请确认 `VITE_BACKEND_URL` 指向正确的同域入口或代理入口。

### 可选环境变量

```bash
REPO_URL=https://github.com/zhuanggenhua/BoardGame.git \   # 仓库地址
APP_DIR=BoardGame \                                       # 代码目录
JWT_SECRET=your-secret \                                  # JWT 密钥（不填则自动生成）
MONGO_URI=mongodb://mongodb:27017/boardgame \            # Mongo 连接
WEB_ORIGINS=https://your-domain.com \                    # CORS 白名单
MIRROR_PROVIDER=multi \                                  # 镜像源方案（默认 multi）
XUANYUAN_DOMAIN=docker.xuanyuan.me \                      # 轩辕镜像域名
CUSTOM_MIRRORS=https://mirror1,https://mirror2 \         # 自定义镜像列表（优先级最高）
SKIP_MIRROR=1 \                                          # 跳过镜像源配置
FORCE_ENV=1 \                                            # 强制覆盖 .env
bash deploy-auto.sh
```

### 镜像源说明（多源 HTTPS）

- 默认使用多源 HTTPS 镜像列表（阿里云、USTC、SJTUG、DaoCloud、dockerproxy）。
- 若你想使用轩辕镜像：设置 `MIRROR_PROVIDER=xuanyuan`，可选 `XUANYUAN_DOMAIN=你的专属域名`。
- 若你想完全自定义：设置 `CUSTOM_MIRRORS` 为逗号分隔的镜像列表（优先级最高）。

## Pages 部署（前后端分离）

架构说明：
- **前端**：Cloudflare Pages 托管（自动构建、CDN 加速）
- **后端**：服务器 Docker + Nginx 反向代理
- **流程**：浏览器 → Cloudflare → Pages/服务器

### 1. Pages 项目设置

Cloudflare 控制台 → **Workers & Pages** → 选择你的 Pages 项目 → **设置**

- **构建设置**：
  - 构建命令：`npm run build`
  - 输出目录：`dist`
- **环境变量**（非常重要）：
  - `VITE_BACKEND_URL` = `https://api.<你的域名>`
  - 例如：`VITE_BACKEND_URL=https://api.easyboardgame.top`
- **如果 Android App 使用 remote WebView 模式**：
  - `ANDROID_REMOTE_WEB_URL` 应指向实际对外可访问的前端页面入口，例如 `https://easyboardgame.top`
  - 不要把 `ANDROID_REMOTE_WEB_URL` 指到纯 API 域名，例如 `https://api.easyboardgame.top`
- **自定义域名**：
  - 点击「自定义域名」→ 添加你的根域（如 `easyboardgame.top`）
  - 系统会自动在 DNS 创建 CNAME 记录

### 2. DNS 配置

Cloudflare 控制台 → 你的域名 → **DNS** → **记录**

需要添加的记录：

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| A | api | 服务器公网 IP | 已代理（橙云）|

> **橙云说明**：开启代理后，Cloudflare 会代理所有请求，提供 SSL、DDoS 防护、CDN 缓存。如果需要直连源站，可改为灰云（仅 DNS）。

### 3. SSL/TLS 设置

Cloudflare 控制台 → 你的域名 → **SSL/TLS** → **概述** → **配置**

选择加密模式：
- **灵活 (Flexible)**：浏览器 → Cloudflare 是 HTTPS，Cloudflare → 源站是 HTTP
- **完全 (Full)**：端到端 HTTPS，需要服务器配置 SSL 证书

> **推荐**：初期用「灵活」快速上线，后续配置 Let's Encrypt 后切换为「完全」。

### 4. 服务器 .env 配置

服务器 `.env` 只需密钥和域名，数据库/Redis/端口由 `docker-compose.prod.yml` 自动覆盖：

```bash
# /home/admin/BoardGame/.env
JWT_SECRET=你的密钥
WEB_ORIGINS=https://easyboardgame.top,https://api.easyboardgame.top,https://boardgame-xxx.pages.dev
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=xxx@qq.com
SMTP_PASS=xxx
```

> **WEB_ORIGINS** 必须包含所有可能访问后端的域名，否则会出现 CORS 错误。
>
> 提示：首次运行 `deploy-image.sh` 时会交互式引导生成 `.env`。

### Android remote WebView 额外约束

如果 Android 壳使用 `ANDROID_WEBVIEW_MODE=remote`，部署侧还需要满足以下条件：

- `ANDROID_REMOTE_WEB_URL` 必须是绝对 HTTPS 地址，且应指向真实前端入口
- 该前端入口加载出来的 H5 仍然会访问你的后端接口，因此 `WEB_ORIGINS` 必须包含这个前端域名
- 远程模式下，Android App 会与线上 Web 同步更新；如果线上前端需要回滚，App 也会一起回滚，不再依赖重新发 APK
- Android `remote` 打包应视为“纯壳模式”：不会执行 `vite build`，也不会把 `dist` 前端资源复制进 APK；打包只更新原生壳、Capacitor 配置和壳内静态资产（例如方向映射、图标、启动图）
- Android `remote` 的 `build-debug / build-release / build-bundle` 不再自动执行 `capacitor sync/update`；如果你新增了 Capacitor 插件、修改了 Android 原生模板或首次初始化工程，先手动执行一次 `npm run mobile:android:sync`
- 当前 Android 壳默认行为：游戏页按 `preferredOrientation` 自动切换横竖屏，并隐藏顶部状态栏；非游戏页恢复竖屏和系统状态栏
- Android 壳进入后台、按 Home、锁屏或熄屏时，会主动通知 H5 停止当前 BGM；恢复前台后默认不自动续播

## Nginx 反向代理（自动管理）

> **无需手动配置**。部署脚本自动安装 Nginx 并管理 `/etc/nginx/conf.d/boardgame.conf`。
>
> | 情况 | 脚本行为 |
> |---|---|
> | 没有 Nginx | 自动安装，创建配置 |
> | 配置已是最新 | 跳过 |
> | 配置过时 | 备份旧的，覆盖新的 |
> | 存在冲突的 `default.conf` | 自动禁用 |
> | 存在用户自建的其他配置 | 不动，冲突时提示 |

### Cloudflare SSL 设置

**重要**：由于服务器 Nginx 只监听 HTTP (80)，需要在 Cloudflare 设置 SSL 模式：

1. 进入 Cloudflare Dashboard → 你的域名 → **SSL/TLS** → **概述**
2. 点击 **配置**
3. 选择 **灵活 (Flexible)** 模式
4. 保存

> **说明**：灵活模式下，Cloudflare 会用 HTTP 连接你的源服务器，而浏览器到 Cloudflare 仍然是 HTTPS。如果需要端到端加密，可以在服务器配置 Let's Encrypt 证书并切换为「完全」模式。

## 部署后注意事项

> **生产环境更新必须使用部署脚本**：`bash scripts/deploy/deploy-image.sh update [tag]`
>
> 禁止在生产服务器上直接运行 `docker compose up -d`，因为默认使用 `docker-compose.yml` 而非 `docker-compose.prod.yml`，两者的端口映射和环境变量配置不同。

## 同域策略

- **开发（Vite 代理）**：
  - 入口：`vite.config.ts`
  - 前端使用同源地址访问：`src/config/server.ts`
  - 代理路径：`/games`、`/default`、`/lobby-socket`、`/auth`

- **生产/容器（NestJS 单体）**：
  - 入口：`apps/api/src/main.ts`（静态托管 + 反向代理）
  - 镜像部署：`docker-compose.prod.yml`（服务器不需要源码，推荐生产环境）
  - 本地开发：`docker-compose.yml`（同样使用 ghcr 预构建镜像）
  - 对外仅暴露 `web`（单体），`game-server` 仅容器网络内通信
  - **注意**：两个 compose 文件都使用 `image:` 拉取 ghcr 镜像，不再本地 build。生产环境必须使用 `deploy-image.sh update [tag]`（基于 `docker-compose.prod.yml`），禁止直接 `docker compose up -d`（会使用默认的 `docker-compose.yml`，配置可能不同）

## 资源 /assets 与对象存储映射（官方）

- **开发**：直接使用 `public/assets`（不配置 R2 也能跑通）。
- **生产**：`/assets/*` 反代到对象存储（如 Cloudflare R2）。
- **对象存储 key 前缀**：`official/<gameId>/...`
  - 路径对应：`/assets/<gameId>/...` ⇄ `official/<gameId>/...`
- **可选独立资源域名**：前端可配置 `VITE_ASSETS_BASE_URL`（默认 `/assets`）。

## 资源发布流程（官方）

1. 准备/更新 `public/assets/<gameId>/...` 资源。
2. 生成清单：`npm run assets:manifest`（输出 `assets-manifest.json`）。
3. 校验清单：`npm run assets:validate`（缺文件/变体不一致会报错）。
4. 上传资源与清单到对象存储（路径 `official/<gameId>/...`）。

## UGC 资源前缀预留（未实现）

- **正式**：`ugc/<userId>/<packageId>/...`
- **审核 staging**：`staging/ugc/<userId>/<packageId>/...`

## 关键配置

- **端口**：前端开发 `5173`；游戏服务 `18000`（容器内部）；API 单体 `80`（镜像部署）/ `3000`（Git 部署）；MongoDB `27017`
- **CORS/Origin 白名单**：`WEB_ORIGINS`（生产环境必填实际域名）
- **前端 API 指向**：`VITE_BACKEND_URL`（仅 Pages 分离部署时配置）
- **环境变量模板**：`.env.example`（开发）、`.env.server`（生产，已 gitignore）

### 环境自动区分

`.env` 保持本地开发配置（`localhost`），Docker 通过 `docker-compose.yml` 自动覆盖为容器名：

| 环境 | MONGO_URI | REDIS_HOST |
|------|-----------|------------|
| `npm run dev` | `localhost:27017` | 留空（内存缓存） |
| `docker compose up` | `mongodb:27017` | `redis` |

> **无需手动切换**：Docker 会自动覆盖 `.env` 中的数据库/Redis 配置。

### .env 配置说明

| 文件 | 用途 | 入 Git | 包含密钥 |
|------|------|--------|----------|
| `.env` | 当前机器实际配置 | ✘ | ✔ |
| `.env.example` | 开发环境模板 | ✔ | ✘ |
| `.env.server` | 生产 .env 生成脚本 | ✘ | ✔ |

**本地开发**：直接复制 `.env.example` 即可。

**生产环境（最小配置）**：只需密钥和域名，其余由 `docker-compose.prod.yml` 覆盖。

```bash
JWT_SECRET=your-secret-key
WEB_ORIGINS=https://your-domain.com
```

推荐使用 `.env.server` 一键生成 `.env`（包含密钥与域名配置）。

## 单体代理说明

- **/games、/default、/lobby-socket、/socket.io** 由 NestJS 反向代理到 game-server
- 代理目标由 `GAME_SERVER_PROXY_TARGET` 指定（Docker 内部默认 `http://game-server:18000`）

## 迁移与扩容准备（强烈建议提前做）

本项目经常会以“首年特价机器”上线，第二年更换厂商/更换服务器是常见操作。为了让迁移成本最低，建议从一开始就按以下原则部署：

- **入口可切换**：域名解析使用 DNS（建议 TTL 设短一些），或使用 Cloudflare 做一层代理入口；迁移时只改源站 IP。
- **状态外置**：
  - 静态资源 `/assets/*` 放对象存储（如 Cloudflare R2 / COS / OSS），避免资源随服务器迁移。
  - 数据库数据可导出导入（MongoDB 走 `mongodump/mongorestore`）。
  - `.env` 等配置文件纳入安全备份（不要只放在服务器上）。
- **部署可重复**：优先使用一键脚本；新机器只需“装 Docker -> 运行脚本”。

### 负载均衡/多实例（预留方向）

当前默认是单机同域部署（`web` 统一入口，反代到 `game-server`），适合小规模。

如果未来要做高可用/水平扩展，可按以下方向演进：

- **入口层**：在 `web` 前放一个 L7 负载均衡（云厂商 SLB/CLB 或自建 Nginx/HAProxy），对外仍只暴露 80/443。
- **无状态服务可扩展**：
  - `apps/api`（NestJS）理论上可多实例（前提：会话/JWT 无状态，WebSocket 需要 sticky 或 socket 统一落到同一实例，或改为共享适配器）。
  - `game-server` 多实例需要谨慎：GameTransportServer 的 match 状态（内存缓存）与 WebSocket 连接需要一致性，通常需要 sticky session + 共享存储/协调（或拆分“大厅/匹配”层）。
- **状态服务单点处理**：MongoDB/Redis 建议走托管或主从/集群，避免单机磁盘与内存成为瓶颈。

## 常见问题

### 部署后验收

- `docker compose ps` 确认 web/game-server/mongodb 为 Running/Healthy
- `ss -lntp | grep ':80'` 确认 80 端口已监听
- `curl -I http://127.0.0.1/` 验证本机入口可达
- `curl http://127.0.0.1/notifications` 应返回 JSON
- `curl http://127.0.0.1/game-changelogs/dicethrone` 应返回 JSON（即使无数据也应是 `{"changelogs":[]}`，不能返回 HTML）

- **健康检查**：
  - 后端：`http://<服务器IP>/health` 或 `https://api.<你的域名>/health`（若未实现则返回 404，属于正常）
  - WebSocket：检查 `wss://api.<你的域名>/lobby-socket` 是否可建立连接
- **排障建议**：
  - `docker compose ps` 看容器是否都在运行
  - `docker compose logs -f web` 查看反向代理/NestJS 日志
  - `docker compose logs -f game-server` 查看游戏服务日志
  - DNS 解析：`nslookup easyboardgame.top` / `nslookup api.easyboardgame.top`
- **521 / 无响应**：Cloudflare 无法连接源站，多为 80 端口未监听或源站服务重启；先确认 `docker compose ps` 与 `ss -lntp | grep ':80'`。
- **容器反复重启**：通常是构建或运行时报错，先看 `docker compose logs -f web` 与 `docker compose logs -f game-server`。
- **web 启动即退出 / Redis 连接失败**：
  - 日志出现 `ECONNREFUSED 127.0.0.1:6379` 多为 Redis 未运行。
  - Docker 下不要写 `REDIS_HOST=localhost`；可选择：
    1) 删除 `.env` 中 `REDIS_HOST/REDIS_PORT`（关闭 Redis，使用内存缓存）。
    2) 在 `docker-compose.yml` 增加 redis 服务，并设 `REDIS_HOST=redis`。
- **端口占用**：
  - 现象：`docker compose up` 提示 `bind: Only one usage of each socket address`。
  - Windows：`netstat -ano | findstr :18000` → `taskkill /F /PID <pid>`
  - Linux：`ss -lntp | grep ':18000'` 或 `lsof -i :18000` → `kill -9 <pid>`
  - 或者只改 `docker-compose.yml` 中 `web` 的端口映射，并同步 `WEB_ORIGINS`
- **WebSocket 不通**：检查 `docker/nginx.conf` 的 Upgrade/Connection 头，以及访问路径是否以 `/default/`、`/lobby-socket/` 开头
- **Vite 本地直连 18000**：
  - `VITE_GAME_SERVER_URL` 仅用于分离部署；本地 dev 建议留空，走 Vite 代理。
  - 查看 `src/config/server.ts` 的回退逻辑，确保 dev 时不会强制指向 `http://127.0.0.1:18000`。
- **为什么 dev 没问题但部署报错**：
  - 本地 `npm run dev:api` 现在通过 `node scripts/infra/dev-bundle-runner.mjs --label api --entry apps/api/src/main.ts --outfile temp/dev-bundles/api/main.mjs --tsconfig apps/api/tsconfig.json`
    先 bundle 再运行产物；Docker 若直接跑源码、tsconfig 或环境变量不一致，仍可能暴露与本地不同的问题。
  - 本地 `npm run dev:game` 现在通过 `node scripts/infra/dev-bundle-runner.mjs --label game --entry server.ts --outfile temp/dev-bundles/game/server.mjs --tsconfig tsconfig.server.json`
    先 bundle 再运行产物；这比直接 `tsx` 更接近“构建后运行”的链路，但仍不等于生产镜像。
  - 默认 `npm run dev` 由 `scripts/infra/dev-orchestrator.js` 协调：API 和 game-server 并行 ready 后才启动前端。
    如果你在 Docker / 服务器环境里没有这层编排，代理目标未就绪、端口未监听或 bundle 产物不存在，都可能只在部署链路中暴露。
