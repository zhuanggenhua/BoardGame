# 部署与运行（同域）

本项目默认采用**同域访问**，避免 CORS 与 WebSocket 跨域问题。

## 入口地址

- **开发**：`http://localhost:5173`
- **Docker 一键部署**：`http://localhost:18080`
- **Pages 预览域名**：`https://<project>.pages.dev`

## 一键部署脚本（推荐）

适用于 Debian/Ubuntu 与 RHEL 系（含 Alibaba Cloud Linux）。脚本会自动完成：安装 Git/Docker/Compose、配置镜像源、克隆仓库、生成 `.env`、启动服务。

在根目录执行
```bash
curl -fsSL https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/scripts/deploy-auto.sh -o deploy-auto.sh && bash deploy-auto.sh
```

## 快速更新脚本（已部署后使用）

适用于已部署的服务器，执行：拉取最新代码 → 重建镜像 → 重启服务。

```bash
cd /home/admin/BoardGame
bash scripts/deploy-quick.sh
```
 

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

- **Pages 项目设置**：Cloudflare 控制台 → Workers & Pages → 选择 Pages 项目 → 设置
  - 构建命令：`npm run build`
  - 输出目录：`dist`
  - 部署命令（占位即可）：`true` 或 `echo skip`
- **Pages 环境变量**：`VITE_BACKEND_URL=https://api.<你的域名>`
- **DNS**：
  - 根域绑定在 Pages 的「自定义域名」，系统会自动创建 CNAME（无需手动加 A 记录）
  - `api.<你的域名>` 需要在 Cloudflare DNS 手动添加 A 记录指向服务器公网 IP

## 同域策略

- **开发（Vite 代理）**：
  - 入口：`vite.config.ts`
  - 前端使用同源地址访问：`src/config/server.ts`
  - 代理路径：`/games`、`/default`、`/lobby-socket`、`/auth`

- **生产/容器（NestJS 单体）**：
  - 入口：`apps/api/src/main.ts`（静态托管 + 反向代理）
  - 编排：`docker-compose.yml`（`web` 服务）
  - 对外仅暴露 `web`（单体），`game-server` 仅容器网络内通信

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

- **端口**：前端开发 `5173`；游戏服务 `18000`；API 单体 `80`（容器内）；MongoDB `27017`
- **CORS/Origin 白名单**：`WEB_ORIGINS`（Docker 默认 `http://localhost:18080`）
- **前端 API 指向**：`VITE_BACKEND_URL`（仅 Pages/前端构建时配置）
- **环境变量示例**：`.env.example`

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
  - `game-server` 多实例需要谨慎：boardgame.io 的 match 状态与 WebSocket 连接需要一致性，通常需要 sticky session + 共享存储/协调（或拆分“大厅/匹配”层）。
- **状态服务单点处理**：MongoDB/Redis 建议走托管或主从/集群，避免单机磁盘与内存成为瓶颈。

## 常见问题

### 部署后验收

- `docker compose ps` 确认 web/game-server/mongodb 为 Running/Healthy
- `ss -lntp | grep ':80'` 确认 80 端口已监听
- `curl -I http://127.0.0.1/` 验证本机入口可达

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
- **端口占用**：优先只改 `docker-compose.yml` 中 `web` 的端口映射，并同步 `WEB_ORIGINS`
- **WebSocket 不通**：检查 `docker/nginx.conf` 的 Upgrade/Connection 头，以及访问路径是否以 `/default/`、`/lobby-socket/` 开头
- **为什么 dev 没问题但部署报错**：
  - 本地 `npm run dev:api` 使用 `tsx --tsconfig apps/api/tsconfig.json`，自动启用 `experimentalDecorators`；
    Docker 若未指定 tsconfig，会导致 NestJS 装饰器报错。
  - 本地 `npm run dev:game` 使用 `vite-node`，ESM 解析与 Docker 中 `tsx` 直接运行不同；
    可能触发 `boardgame.io/server` 解析到不存在的 `index.jsx`。
