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

脚本会自动完成：下载 compose 文件 → 引导生成 `.env` → 检查宿主机 Docker 基础条件 → 拉取镜像 → 启动服务。

> **强制边界**：`deploy-image.sh deploy/update/rollback` 只负责业务镜像发布，不负责替宿主机修改 Docker daemon 配置。像 `/etc/docker/daemon.json`、`registry-mirrors`、daemon 重载/重启 这类宿主机基础设施动作，必须作为独立运维动作处理，不能混进正式部署链。

> **架构**：Cloudflare (HTTPS + CDN) → 服务器 80 端口 → Docker web 容器 (NestJS monolith) → 内部 game-server
> 无 Nginx，NestJS 直接监听 80 端口。Cloudflare 代理提供 SSL 和 CDN。

### 更新部署

```bash
bash deploy-image.sh update
bash deploy-image.sh update v1.2.3  # 部署指定 tag
```

**强制规则**：生产环境更新必须**等待 CI 镜像构建完成**后再执行（对应 commit/tag 的镜像已推送到仓库）。  
未确认 CI 构建完成时禁止执行 `update`，避免拉取到旧镜像或半成品镜像。

**默认最新部署口径（强制）**：当目标是“更新部署 / 部署最新 / 发线上”，且没有明确指定版本时，默认不是单独更新服务器，而是按“版本自增 -> 提交 push -> 等 CI -> 服务器 latest -> Android stable OTA”执行。产品版本号 `package.json.version` 与 Android `androidVersionCode` 必须同步自增；只有用户明确说“本次不改版本”时，才允许跳过。

```bash
# 1) 先准备版本，默认 patch；也可显式传 --bump minor / --bump major
node scripts/release/deploy-and-ota.mjs --prepare-version

# 2) 提交并 push package.json / package-lock.json，等待 CI 镜像构建完成

# 3) 部署 latest 并发布 stable OTA
BG_DEPLOY_VERSION_PREPARED=1 node scripts/release/deploy-and-ota.mjs --skip-wait
```

PowerShell 下第 3 步写法：

```powershell
$env:BG_DEPLOY_VERSION_PREPARED='1'; node scripts/release/deploy-and-ota.mjs --skip-wait
```

如果用户明确说“只更新服务器”或“这次不发 OTA”，才允许缩小为只执行 `bash deploy-image.sh update`。如果用户明确说“这次不改版本”，执行统一入口时必须显式加 `--allow-current-version`，避免误把旧产品版本再次发布成最新。禁止为了“固定版本”临时根据 commit SHA、短 SHA、run number 或猜测格式拼出 `bash deploy-image.sh update <tag>`；如果需要指定 tag，必须先证明 `ghcr.io/zhuanggenhua/boardgame-web:<tag>` 与 `ghcr.io/zhuanggenhua/boardgame-game:<tag>` 都已存在。

**镜像拉取等待口径（强制）**：`docker pull` / `deploy-image.sh update` 正在下载镜像层时，只要能看到层进度、已下载字节数或阶段变化，就默认继续等待，不得把“下载慢”直接判定为失败并改走补救链路。只有满足以下任一条件，才允许进入 fallback：连续多次超时且同一层无新增进度；明确报网络/认证/磁盘错误；服务器或本机/CI 对同一镜像均无法完成拉取；或用户明确要求停止等待。切换 fallback 时，必须说明这是“镜像分发补救”，不是正式镜像拉取链路已成功。

**正式 fallback（当服务器直拉 GHCR 大层失败时）**：先在网络更好的机器或 CI 上执行：

```bash
node scripts/deploy/stream-images-to-server.mjs --tag <tag> --host admin@8.148.71.102 --remote-dir /home/admin/BoardGame --deploy
```

这条链路会先在本地导出镜像 tar、上传到生产机、再在服务器本地导入镜像，然后执行：

```bash
bash scripts/deploy/deploy-image.sh update-local <tag>
```

`update-local` 仍然会复用同一套 `post-deploy smoke + 自动回退`；变化的只是镜像分发方式，不是部署门禁。

### 宿主机 Docker 镜像源配置（独立动作）

如需显式写入项目默认镜像源，请在宿主机单独执行：

```bash
bash deploy-image.sh configure-mirror
```

约束：

- 这是**宿主机基础设施维护**，不是业务部署步骤。
- `configure-mirror` 只会更新 `/etc/docker/daemon.json` 里的 `registry-mirrors` 字段，并尝试向 `dockerd` 发送 `SIGHUP` 重新加载配置。
- `configure-mirror` 不会自动跟 `deploy/update/rollback` 绑定执行，也不应把“镜像源治理”当成每次发版的一部分。
- 如果生产机已有运维维护的 Docker daemon 配置，应继续以运维配置为真相源，不要依赖业务部署脚本覆盖。
- `deploy/update/rollback` 拉取范围默认只包含应用服务 `game-server` 与 `web`；`mongodb`、`redis` 这类基础依赖应以宿主机现有缓存/既有镜像为准，不应把每次业务发版绑定到 Docker Hub 可用性。
- 公网入口资源一致性门禁默认关闭；只有显式设置 `PUBLIC_WEB_URL` 时才会检查。当前正式根域名走 Pages，服务器部署默认不应拿 `http://127.0.0.1/` 与 `https://easyboardgame.top/` 比入口资源。

### 回滚 / 状态 / 日志

```bash
bash deploy-image.sh rollback v1.2.3   # 回滚到指定版本
bash deploy-image.sh rollback-last     # 回滚到上次成功部署版本
bash deploy-image.sh status             # 查看状态
bash deploy-image.sh logs [service]     # 查看日志
```

### 后台部署回滚执行器

发布中心里的“执行回滚”不应由 `boardgame-web` 容器自己执行，否则回滚过程中可能重启或替换当前容器，导致控制请求中断、结果不可知。

生产环境应在宿主机安装独立 systemd 服务：

```bash
cd /home/admin/BoardGame
bash scripts/deploy/install-deploy-runner.sh
```

安装脚本会创建并启动 `boardgame-deploy-runner.service`，默认以 `root` 运行，确保它能执行 Docker 部署 / 回滚命令。若确认某个非 root 用户已经具备 Docker 权限，也可以安装时传 `RUNNER_USER=admin`。脚本会输出一串 `BG_DEPLOY_RUNNER_TOKEN`，把这串 token 写入服务器 `.env`：

```bash
BG_DEPLOY_RUNNER_URL=http://host.docker.internal:18761
BG_DEPLOY_RUNNER_TOKEN=安装脚本输出的token
```

> **镜像拉取超时口径**：直接执行 `deploy-image.sh` 时，单次 `docker pull` 默认最多等待 10800 秒（3 小时）。`boardgame-deploy-runner` 安装脚本会在宿主机环境文件里设置 `DEPLOY_IMAGE_PULL_TIMEOUT_SECONDS=0`，避免内外两层重复计时；后台部署改由 `BG_DEPLOY_RUNNER_DEPLOY_STEP_TIMEOUT_SECONDS=10800` 提供 3 小时整步保护。如果需要调整整体部署保护，应修改 runner 的整步超时，不要恢复短时镜像拉取限制。
>
> **后台进度日志口径**：runner 环境同时设置 `COMPOSE_PROGRESS=plain` 与 `DOCKER_CLI_HINTS=false`，让 Docker Compose 输出适合后台轮询展示的纯文本拉取阶段，而不是只适合终端刷新的动态进度。

然后按正常部署链路更新 `boardgame-web` 容器，让环境变量进入容器：

```bash
bash scripts/deploy/deploy-image.sh update
```

验证：

```bash
systemctl status boardgame-deploy-runner
curl http://127.0.0.1:18761/health
```

约束：

- runner 是宿主机服务，不放进 `docker-compose.prod.yml` 管理的服务列表。
- runner 默认优先监听 Docker 网桥地址，供 `web` 容器通过 `host.docker.internal` 访问；不要把它当公网 HTTP 入口使用。
- `docker-compose.prod.yml` 只给 `web` 容器注入 `BG_DEPLOY_RUNNER_URL` / `BG_DEPLOY_RUNNER_TOKEN`，让后台调用 runner。
- runner 默认执行 `scripts/deploy/deploy-image.sh rollback-last` 或 `rollback <tag>`，并要求确认文案与 token。
- 如果未配置 token 或 runner 不可达，后台只能生成回滚命令预览，不能执行回滚。

### 固定版本部署（仅明确指定 / 回滚排障）

```bash
bash deploy-image.sh deploy v1.2.3  # 首次部署指定 tag
bash deploy-image.sh update v1.2.3  # 更新到指定 tag
```

- 不传 tag 时默认部署 `latest`
- 传入 tag 时，脚本会统一把 `game-server` 和 `web` 切到同一版本，便于排障与回滚
- 这些 tag 来自 GitHub Actions 发布的镜像标签（例如推送 Git tag `v1.2.3` 后生成对应镜像）
- 固定版本部署只适用于“用户明确指定版本”或“已验证精确 tag 存在”的场景；不得把短 commit、`sha-xxxxxx`、GitHub Actions run number 等推测值当作可部署 tag。

### CI 配置说明

镜像由 GitHub Actions 自动构建并推送到 GHCR（`.github/workflows/docker-publish.yml`）：

- **触发条件**：push 到 `main` 分支 或 创建 `v*` 标签
- **镜像地址**：
  - `ghcr.io/zhuanggenhua/boardgame-game:latest`
  - `ghcr.io/zhuanggenhua/boardgame-web:latest`
- **版本标签**：`latest`（main 分支）、`v1.2.3`（tag）、`sha-xxxxxx`（commit）
- **部署注意**：上面的版本标签以 CI 实际输出和 GHCR 实际存在为准；日常生产“最新”部署不需要也不应指定 commit tag，直接使用 `update` 拉取 `latest`。

> **当前自动部署脚本的真实入口**：`boardgame-web` 是基于 `docker/Dockerfile.monolith` 构建的单体镜像，负责静态资源、`/auth`、`/notifications`、`/social-socket` 等 API / WebSocket 入口；`deploy-image.sh` 不会部署独立的 `auth-server`，也不会使用 `docker/Dockerfile.web` / `docker/nginx.conf` 作为生产主链路。
>
> **当服务器直拉 GHCR 不稳定时**：正式 fallback 不是“在服务器本地重建一遍前端”，而是先用 `node scripts/deploy/stream-images-to-server.mjs --tag <tag> --deploy` 把镜像送到生产机，再在服务器上走 `update-local`。

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
JWT_SECRET=your-secret \                                  # JWT 密钥（不填则自动生成）
WEB_ORIGINS=https://your-domain.com \                    # CORS 白名单
SKIP_MIRROR=1 \                                          # 跳过镜像源检查提示
bash deploy-image.sh update
```

### 镜像源说明（宿主机运维）

- 项目脚本内置的默认镜像源列表是：阿里云、USTC、SJTUG、DaoCloud、dockerproxy。
- 这些镜像源只在你**显式执行** `bash deploy-image.sh configure-mirror` 时才会写入宿主机。
- `deploy/update/rollback` 不会自动写入、覆盖或重建宿主机的 `registry-mirrors`。
- 若生产机已有自定义镜像源、代理或私有 registry 配置，应继续以宿主机现有运维配置为准。

## Pages 部署（前后端分离）

架构说明：
- **前端**：Cloudflare Pages 托管（自动构建、CDN 加速）
- **后端**：服务器 Docker + Nginx 反向代理
- **流程**：浏览器 → Cloudflare → Pages/服务器
- **当前正式环境口径**：`easyboardgame.top` 是 Pages 自定义域名，`api.easyboardgame.top` 才指向服务器；因此“根域名前端是否更新”必须先看 Pages / GitHub `main` 发布链，不能默认拿服务器 `dist` 当真相源

### 1. Pages 项目设置

Cloudflare 控制台 → **Workers & Pages** → 选择你的 Pages 项目 → **设置**

- **构建设置**：
  - 构建命令：`npm run build`
  - 输出目录：`dist`
- **环境变量**（非常重要）：
  - `VITE_BACKEND_URL` = `https://api.<你的域名>`
  - 例如：`VITE_BACKEND_URL=https://api.easyboardgame.top`
- **如果 Android App 临时使用 remote WebView 模式**：
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

如果 Android 壳临时使用 `ANDROID_WEBVIEW_MODE=remote`，部署侧还需要满足以下条件：

- `ANDROID_REMOTE_WEB_URL` 必须是绝对 HTTP/HTTPS 地址，且应指向真实前端入口
- 除局域网临时调试或短期灰度外，仍优先使用 HTTPS
- 该前端入口加载出来的 H5 仍然会访问你的后端接口，因此 `WEB_ORIGINS` 必须包含这个前端域名
- 远程模式下，Android App 会与线上 Web 同步更新；如果线上前端需要回滚，App 也会一起回滚，不再依赖重新发 APK
- Android `remote` 打包应视为“纯壳模式”：不会执行 `vite build`，也不会把 `dist` 前端资源复制进 APK；打包只更新原生壳、Capacitor 配置和壳内静态资产（例如方向映射、图标、启动图）
- Android `remote` 的 `build-debug / build-release / build-bundle` 不再自动执行 `capacitor sync/update`；如果你新增了 Capacitor 插件、修改了 Android 原生模板或首次初始化工程，先手动执行一次 `npm run mobile:android:sync`
- 当前 Android 壳默认行为：游戏页按 `preferredOrientation` 自动切换横竖屏，并隐藏顶部状态栏；未声明固定方向的非游戏页恢复系统默认方向和系统状态栏
- 若首页 V2、活动页、教程页等**非游戏页**也要求固定方向，必须让原生 `MainActivity` 显式识别该路由或读取构建元数据；**不能只靠 H5 层 `MobileOrientationGuard` 试图锁屏**
- Android 壳进入后台、按 Home、锁屏或熄屏时，会主动通知 H5 停止当前 BGM；恢复前台后默认不自动续播

> **主线口径**：`remote WebView` 只作为兼容 / 调试 / 短期灰度路径保留。Android 的长期主线应是 `embedded` 打包；若未来需要热更新 H5 本体，应演进为 `embedded + OTA/Live Update`，而不是继续把 `remote` 当默认产品方案。

### Android embedded OTA 发布源

当前 Android 主线热更新不再依赖 `remote`，而是：

- App 打包仍走 `embedded`
- H5 本体通过 OTA manifest + zip bundle 更新
- 发布源复用同一个对象存储桶，路径前缀为 `official/app-updates/android/<channel>/...`

默认约定：

- `latest.json`：`https://assets.easyboardgame.top/official/app-updates/android/<channel>/latest.json`
- bundle zip：`https://assets.easyboardgame.top/official/app-updates/android/<channel>/bundles/<bundleVersion>.zip`
- version manifest：`https://assets.easyboardgame.top/official/app-updates/android/<channel>/manifests/<bundleVersion>.json`

发布命令：

```bash
node scripts/mobile/release-android.mjs ota --channel stable --dry-run
node scripts/mobile/release-android.mjs ota --channel stable --skip-latest
node scripts/mobile/release-android.mjs ota --channel stable
```

强制约束：

- Android OTA 发布不得把 `public/assets/i18n/**` 这类大体积运行时资源打进 OTA zip；这些资源应继续走 R2 / 游戏包链路，而不是 H5 OTA。
- `scripts/mobile/publish-android-ota.mjs` 只接受显式命名参数，并要求 `dist/` 已经经过 Android 专用裁剪；若 `dist/` 中仍存在 `dist/assets/i18n/**` 或非 `dist/locales/zh-CN/**` 资源，脚本会直接失败，禁止继续发布。
- 若最终 OTA zip 体积异常过大（当前门禁为 `20MB`），发布脚本必须直接失败，禁止继续覆盖 `latest.json`。

GitHub Actions 自动化：

- 手动 OTA workflow：`.github/workflows/android-ota-publish.yml`
- 普通 `push main` 不得自动发布 **stable OTA**，也不得自动回写版本号。
- 手动触发：可选择 `stable` / `gray` / `edge` 单独发布 OTA，并支持 `dry_run`、`skip_latest`、`force_update`、`ota_version_base`。
- 正式门禁：`stable` 应绑定 `android-ota-production` Environment 审批。
- OTA 内部游标：客户端按 bundle `version` 这个单调递增游标判断新旧；`publishedAt` 只用于审计和展示。若旧客户端曾记住错误大版本，例如 `5.9.0`，可用 `ota_version_base=6.0.0` 发桥接包。
- 项目强制规则：OTA manifest 不得再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`；所有已安装版本默认都必须收到 OTA。若误传这些参数，发布脚本必须直接失败。

约束：

- `--dry-run` 只本地打 zip 和 manifest，不上传
- Android native embedded APK 也必须遵守“轻包体”约束：只允许内置壳运行必需的 H5 bundle 与轻量静态文件，`public/assets/common/audio/**` 这类运行时大资源必须继续走 R2 / 游戏包链路。
- `scripts/mobile/android.mjs` 会在 Android embedded 构建阶段主动裁掉 `dist/assets/common/audio/**`，并在 `dist/` 或 `android/app/src/main/assets/public/` 里仍检测到这些前缀时直接失败。
- `--skip-latest` 会上传 bundle 与版本 manifest，但不会切换该 channel 的 `latest.json`
- 正式覆盖 `latest.json` 后，指向该 channel 的 Android App 会在下一次启动后的后台检查中感知到新 bundle，并在切后台或重启后生效
- OTA 只覆盖 Web bundle；涉及原生层改动时仍必须重新发 APK / AAB

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
> 如果目标镜像已经通过正式 fallback 预先导入到服务器本地，可改用：`bash scripts/deploy/deploy-image.sh update-local [tag]`
>
> 禁止在生产服务器上直接运行 `docker compose up -d`，因为默认使用 `docker-compose.yml` 而非 `docker-compose.prod.yml`，两者的端口映射和环境变量配置不同。
>
> **部署回滚执行边界**：后台发布中心不直接在 `boardgame-web` 容器内执行部署 / 回滚脚本。实际执行者必须是宿主机上的 `boardgame-deploy-runner` systemd 服务；这样 `deploy-image.sh` 重启或替换 `boardgame-web` 时，控制部署回滚的进程不会一起被停掉。
>
> **当前部署脚本已内建 post-deploy smoke + 自动回退**：更新后会自动等待关键容器 ready，并检查首页、`/health`、`/notifications`。若新版本 smoke 失败，脚本会自动回退到部署前实际运行的 `web` / `game-server` 镜像引用，并再次执行 smoke。即使自动回退成功，本次更新命令仍会以失败状态退出，用于明确提示“服务已恢复，但升级未成功”。

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
  - **注意**：两个 compose 文件都使用 `image:` 拉取 ghcr 镜像，不再本地 build。生产环境必须使用 `deploy-image.sh update [tag]` 或 `deploy-image.sh update-local [tag]`（基于 `docker-compose.prod.yml`），禁止直接 `docker compose up -d`（会使用默认的 `docker-compose.yml`，配置可能不同）
  - `web` 容器通过 `BG_DEPLOY_RUNNER_URL` 访问宿主机上的 `boardgame-deploy-runner`；runner 不属于同一个 compose 项目，避免回滚时把执行器一起重启

### 训练数据持久化合同

- 生产 `game-server` 必须把 `TRAINING_DATA_DIR` 固定为 `/data/training-data`，并挂载独立命名卷 `training_data`；容器重建不得依赖镜像可写层保存正式训练数据。
- 决策样本先进入 `pending/`，只有对局真实结束、达到游戏级或全局最低完成时长、且该游戏正式数据未达到 300MiB 时，才原子提交到 `completed/`。
- `raw/` 与 `archive/` 是既有正式数据目录，容量门禁会继续计入，但本治理变更不会删除、截断或迁移现有文件。
- 每个游戏达到 300MiB 后整局拒收，新对局不会部分追加到旧文件；异常退出最多留下非正式 `pending` 文件。

## 资源 /assets 与对象存储映射（官方）

- **开发**：直接使用 `public/assets`（不配置 R2 也能跑通）。
- **生产默认**：前端资源基址为官方资源域名 `https://assets.easyboardgame.top/official`。
- **生产兼容方案**：也可将 `/assets/*` 反代到对象存储（如 Cloudflare R2）。
- **对象存储 key 前缀**：`official/<gameId>/...`
  - 路径对应：`/assets/<gameId>/...` ⇄ `official/<gameId>/...`
- **资源基址配置**：前端可通过 `VITE_ASSETS_BASE_URL` 覆盖；当前代码内置默认值为 `https://assets.easyboardgame.top/official`。
- **缓存失效机制**：构建时会扫描 `public/assets`，为资源 URL 自动追加 `?v=<content-hash>`。资源内容变化后 URL 会自动变化，因此 R2 上的图片/音频/SVG 可以安全使用长期缓存。
- **本地 JSON / 图集配置**：仍走本地 `/assets`，但同样会追加 `?v=<content-hash>`，避免本地回退路径拿到旧配置。

### 生产素材域名：服务器优先、R2 自动回退

- **公开 URL 不变**：Web、Android 和协作者继续使用 `https://assets.easyboardgame.top/official/...`，不需要知道素材由服务器还是 R2 返回。
- **普通运行时素材**：`assets.easyboardgame.top/*` 进入 `boardgame-asset-router` Worker。Worker 先请求隐藏源 `assets-origin.easyboardgame.top`，隐藏源再通过 Tunnel 访问生产机 `127.0.0.1:19090`。
- **自动回退**：服务器连接失败、1500ms 内没有响应头，或返回 `404`、`408`、`429`、`5xx` 时，Worker 使用同 key 的 R2 对象返回。客户端仍访问原域名。
- **大型发布包始终绕过服务器**：以下更具体的无脚本 Route 直接使用原 R2 自定义域名：
  - `assets.easyboardgame.top/official/app-updates/*`
  - `assets.easyboardgame.top/official/mobile-packages/*`
  - `assets.easyboardgame.top/official/native-app-updates/*`
- **R2 仍是真相源**：上传、移动包和 OTA 发布入口不变，正式对象必须先写入 R2。服务器目录只是可从 R2 重建的只读镜像，禁止服务器单边发布。
- **这不是客户端裸 IP 直连**：请求仍经过 Cloudflare Worker 和 Tunnel，因此保留 HTTPS、同域和自动回退；不能承诺与客户端直接访问服务器公网 IP 完全相同的延迟。

服务器静态源保护参数：

- systemd 服务：`boardgame-asset-origin.service`
- 仅监听：`127.0.0.1:19090`
- 全局同时传输连接：32
- 单客户端同时连接：4
- 每个响应前 1MiB 不限速，之后 2MiB/s
- CPU 上限：25%
- 内存上限：128MB
- IO 权重：10

诊断：

```bash
curl -I "https://assets.easyboardgame.top/official/common/images/noise.svg?probe=$(date +%s)"
```

- `X-Asset-Source: server`：普通素材由服务器镜像返回。
- `X-Asset-Source: r2-fallback`：服务器不可用或缺少对象，本次请求已自动回退 R2。
- 大型发布包没有 `X-Asset-Source`：命中无脚本 Route，直接由 R2 自定义域名返回。

素材服务运维：

```bash
sudo systemctl status boardgame-asset-origin.service
sudo systemctl restart boardgame-asset-origin.service
```

Worker 回滚只删除 `assets.easyboardgame.top/*` 这一条 catch-all Route，保留三条大型包绕过 Route、DNS 和 R2 自定义域名。删除后普通素材立即恢复原 R2 直出；重新绑定该 Route 到 `boardgame-asset-router` 即恢复服务器优先。变更快照保存在 `temp/cloudflare-snapshots/`。

## 非 /assets 静态资源缓存策略（当前主链路）

- **适用范围**：`/fonts/*`、`/logos/*`、大多数 `/game-data/*` 即使没有上 R2，也可以使用长期缓存；关键不在“是否走对象存储”，而在“URL 是否带内容版本指纹”。
- **当前实现**：构建阶段会为 `public/fonts`、`public/logos`、静态 `public/game-data` 生成内容 hash，并在最终 `index.html`、字体 CSS、运行时代码引用里自动追加 `?v=<content-hash>`。
- **服务端缓存头**：生产单体服务会把上述目录按 `Cache-Control: public, max-age=31536000, immutable` 提供；浏览器或 Cloudflare 拿到新 URL 才会请求新内容。
- **例外文件**：`/game-data/summonerwars.layout.json` 仍保持 `no-cache, no-store, must-revalidate`，因为它承载运行时布局编辑结果，不能误进长期缓存。
- **入口页策略不变**：`index.html` 和 SPA fallback 继续 `no-cache, no-store, must-revalidate`，确保部署后刷新页面一定拿到新的资源引用关系。
- **部署门禁新增**：`scripts/deploy/deploy-image.sh` 现在会在 smoke 通过后，再校验**公网首页引用的入口资源**是否与 `PUBLIC_ENTRY_SYNC_SOURCE_URL` 一致；默认仍是 `http://127.0.0.1/`，适用于“根域名直指服务器”的链路。
- **Pages 根域名额外约束**：如果根域名实际挂在 Pages（当前正式环境就是 `easyboardgame.top -> boardgame-e6c.pages.dev`），不要再用服务器 `127.0.0.1` 当比对源。此时应把 `PUBLIC_ENTRY_SYNC_SOURCE_URL` 设为对应的 Pages 域名或某次 Pages 部署 URL，例如 `https://boardgame-e6c.pages.dev/`；否则部署门禁会把“服务器较新、Pages 较旧”的正常分叉误报成 CDN 缓存问题。
- **Cloudflare purge 约定**：若服务器环境提供 `CLOUDFLARE_ZONE_ID`，以及 `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_AUTH_EMAIL + CLOUDFLARE_GLOBAL_API_KEY`，部署脚本默认按 `CLOUDFLARE_PURGE_MODE=auto` 自动执行 purge（有凭据时等价于 `everything`）；若公网仍可能命中旧入口包，这是正式部署链的第一补救动作。
- **新增 game-data 的判断规则**：如果文件是“构建期静态产物”，应纳入版本指纹 + 长缓存；如果文件可能被后台、编辑器或运行时直接改写，则默认保守缓存，除非同时设计了独立版本号或发布链路。

## 资源发布流程（官方）

1. 准备/更新 `public/assets/<gameId>/...` 资源。
2. 生成清单：`npm run assets:manifest`（输出 `assets-manifest.json`）。
3. 校验清单：`npm run assets:validate`（缺文件/变体不一致会报错）。
4. 上传资源与清单到对象存储（路径 `official/<gameId>/...`）。
5. 如仅修改了对象元数据（例如 `Cache-Control`），使用 `npm run assets:upload:force` 重新上传；常规图片/音频资源内容更新不需要手动 purge，因为 URL 会随内容 hash 自动变化。
6. 但 **Web 首页入口与 Vite 产物映射不是 R2 资源**。若线上反馈表现为“源站已是新版本，公网仍在发旧 `index-*.js` / `MatchRoom-*.js`”，必须改走 Cloudflare purge / 公网入口一致性排查，而不是继续猜修业务代码。

### Android OTA 产物发布流程

Android OTA 产物也走同一个对象存储桶，但前缀独立：

1. 日常主线：`push main` 只触发常规 CI，不自动切换 Android OTA 最新入口。
2. OTA 发布必须由人工/后台触发，`stable` 需要走正式审批。
3. 若只想单独操作 OTA 灰度/预演，继续手动执行：
   - `node scripts/mobile/release-android.mjs ota --channel gray --dry-run`
   - `node scripts/mobile/release-android.mjs ota --channel gray --skip-latest`
   - `node scripts/mobile/release-android.mjs ota --channel gray`
4. 若要桥接旧客户端错误大版本，可执行：`node scripts/mobile/release-android.mjs ota --channel stable --ota-version-base 6.0.0 --force-update`
5. 若要本地一次性正式发布 stable OTA + native，可执行：`node scripts/mobile/release-android.mjs full --channel stable`

当前默认发布节奏：

1. 使用 `node scripts/release/deploy-and-ota.mjs --prepare-version` 让产品版本号主动自增；默认 patch，会同步更新 `package.json.version`、`package-lock.json` 和 Android `androidVersionCode`。
2. 提交并 push 版本改动，等待常规 CI 镜像构建完成，确保 `latest` 镜像已经包含这次版本号。
3. 执行 `BG_DEPLOY_VERSION_PREPARED=1 node scripts/release/deploy-and-ota.mjs --skip-wait`，服务器部署 `latest`，并发布同一产品版本基线的 Android `stable` OTA。
4. 发布脚本生成或接收单调递增的 OTA 内部游标；桥接场景可临时使用 `6.0.0-ota-...`，但本次发布的产品基线仍必须来自已提交的 `package.json.version`。

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

**强制约定**：凡是本地开发脚本、资源脚本或校验脚本会读取的环境变量，新增或修改时必须同步更新 `.env.example`。不能假设“只写进 `.env` 就够了”，也不能依赖“`.env` 缺字段时自动回退到 `.env.example`”，因为只要本机存在 `.env`，很多脚本就会优先读取它；如果 `.env` 里缺少某个字段，脚本可能直接报错。`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME` 属于这类必须同时维护在 `.env.example` 的变量。

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
