# 部署与运行事实

本文只记录当前生产部署拓扑、入口和验收事实。执行“更新部署 / 发线上”时，优先使用项目 [`deploy-after-ci`](../.spec/skills/deploy-after-ci/SKILL.md)；涉及 Android OTA 或 native 包时同时使用 [`android-app-release`](../.spec/skills/android-app-release/SKILL.md)。

## 当前拓扑

- 生产 Web 入口：Cloudflare / Pages 或固定公网域名。
- 生产业务服务：服务器 80 端口，同域代理到 Docker 容器。
- 容器：`web` 与 `game-server`，通过生产 compose 启动。
- 镜像来源：GitHub Actions 构建出的 GHCR 镜像。
- 默认镜像分发：CI job 构建后直接 `docker save`、SCP 到服务器、`docker load`，再执行服务器本地 `update-local`。
- 资源主源：`https://assets.easyboardgame.top/official/...`。

## 默认发布入口

完整更新部署默认包含服务器生产部署和 Android stable OTA：

```bash
node scripts/release/deploy-and-ota.mjs --skip-wait
```

只有正式商业产品版本或原生壳版本发布才先准备版本：

```bash
node scripts/release/deploy-and-ota.mjs --prepare-version
# 提交并 push package.json / package-lock.json
```

如果本轮明确不发 OTA：

```bash
node scripts/release/deploy-and-ota.mjs --skip-ota
```

如果等待超时但 GitHub workflow 仍在运行，续等已有 run：

```bash
node scripts/release/deploy-and-ota.mjs --resume-ci-run-id <id> --resume-ota-run-id <id> --workflow-timeout-minutes 45
```

只有用户明确要求时才使用 fallback：

| fallback | 入口 | 说明 |
| --- | --- | --- |
| 本机输送 | `--deploy-mode stream` | 本机拉镜像、导出 tar、上传服务器 |
| 服务器直拉 | `--deploy-mode remote` | 服务器从镜像仓库拉取 |
| 只更新服务器 | `--skip-ota` | 必须说明不包含 Android OTA |

服务器部署版本以 git ref、CI run 和镜像为准。OTA 包版本在上传时生成或通过 `--ota-extra "--version <bundleVersion>"` / `--ota-extra "--product-version <version>"` 显式传入；普通服务器热更新不要求修改 `package.json.version`。

不要把普通 `push main` 自动 Docker workflow、手工 `docker compose up -d`、本机临时拉镜像，冒充默认完整部署链。

## 服务器脚本

| 脚本 | 职责 |
| --- | --- |
| `scripts/deploy/deploy-image.sh` | 服务器镜像部署、状态、日志和回滚 |
| `scripts/deploy/stream-images-to-server.mjs` | 本机输送 fallback |
| `scripts/deploy/deploy-runner.mjs` | 后台部署 / 回滚执行器 |
| `scripts/deploy/install-deploy-runner.sh` | 安装宿主机 systemd runner |
| `scripts/deploy/watch-game-server-cpu.sh` | game-server CPU 现场留档与止血 |

`deploy-image.sh deploy/update/rollback` 只负责业务镜像发布。Docker daemon、registry mirror、宿主机安全策略和基础依赖维护是独立运维动作，不能混进每次正式部署。

## 生产验收

服务器部署完成至少回查：

- 目标镜像 tag 或目标提交。
- `web` 与 `game-server` 容器状态。
- 健康接口和关键页面入口。
- 若本轮包含 OTA：Android OTA workflow 结果、`latest.json`、bundle URL、checksum、size 和 CORS 预检。
- 若本轮包含资源发布：服务器资源主源的对象大小、hash 或本次发布来源头。
- 回到用户原始失败位点验证。

部署动作成功只说明产物切换完成；不能替代业务问题验收。

## 资源与缓存

- 公开资源域名保持 `https://assets.easyboardgame.top/official/...`。
- Android `latest.json` 控制入口必须由域名直返当前 JSON，禁止 30x 跳转和旧对象存储正文。
- 大型 ZIP / APK 用服务器来源、`Content-Length`、hash 或 manifest 校验；不能用旧 fallback 对象证明本次发布成功。
- IP 主源可作为下载和新客户端兜底，不能替代旧客户端域名控制入口验收。
- Web 首页入口命中旧 `index-*.js` / `MatchRoom-*.js` 时，先走 Cloudflare purge / 入口一致性排查，不要猜修业务代码。

Cloudflare purge 由部署脚本在存在凭据时自动执行；没有凭据时只能报告公网缓存仍可能滞后。

## 数据与持久化

- 生产训练数据目录固定为 `/data/training-data`，挂载独立命名卷 `training_data`。
- 容器重建不得依赖镜像可写层保存正式训练数据。
- MongoDB、Redis 等基础依赖不应跟随每次业务发版反复拉取或重建，除非用户明确要求运维动作。

## CPU 监控

`watch-game-server-cpu.sh` 只做现场留档、报警和可选止血。`reason=sustained_high_cpu` 只表示“持续高 CPU 触发了止血动作”，不是业务根因。定位根因必须回到 CPU profile、堆栈、房间、日志和命令失败反馈。

在线 AI 卡死优先查 watchdog、自动恢复、命令失败反馈和合法动作摘要；反复重启只能算止血。

## 配置

凡是本地开发脚本、资源脚本或校验脚本会读取的环境变量，新增或修改时同步更新 `.env.example`。本机存在 `.env` 时，脚本通常优先读它，不能假设会自动回退到 `.env.example`。
