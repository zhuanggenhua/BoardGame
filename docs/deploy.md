# 部署与运行（同域）

本项目默认采用**同域访问**，避免 CORS 与 WebSocket 跨域问题。

## 入口地址

- **开发**：`http://localhost:5173`
- **Docker 一键部署**：`http://localhost:18080`

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
- **部署可重复**：使用 `docker-compose.yml` + 环境变量完成一键部署；新机器只需“装 Docker -> 拉代码/镜像 -> 起 compose”。

### 负载均衡/多实例（预留方向）

当前默认是单机同域部署（`web` 统一入口，反代到 `game-server`），适合小规模。

如果未来要做高可用/水平扩展，可按以下方向演进：

- **入口层**：在 `web` 前放一个 L7 负载均衡（云厂商 SLB/CLB 或自建 Nginx/HAProxy），对外仍只暴露 80/443。
- **无状态服务可扩展**：
  - `apps/api`（NestJS）理论上可多实例（前提：会话/JWT 无状态，WebSocket 需要 sticky 或 socket 统一落到同一实例，或改为共享适配器）。
  - `game-server` 多实例需要谨慎：boardgame.io 的 match 状态与 WebSocket 连接需要一致性，通常需要 sticky session + 共享存储/协调（或拆分“大厅/匹配”层）。
- **状态服务单点处理**：MongoDB/Redis 建议走托管或主从/集群，避免单机磁盘与内存成为瓶颈。

## 常见问题

- **端口占用**：优先只改 `docker-compose.yml` 中 `web` 的端口映射，并同步 `WEB_ORIGINS`
- **WebSocket 不通**：检查 `docker/nginx.conf` 的 Upgrade/Connection 头，以及访问路径是否以 `/default/`、`/lobby-socket/` 开头
