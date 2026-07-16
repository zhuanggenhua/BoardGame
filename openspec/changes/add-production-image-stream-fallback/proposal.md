# Change: add-production-image-stream-fallback

## Why
这次生产更新失败的真实根因，不是业务代码、不是 CI 构建，也不是部署脚本没执行，而是**生产机到 GHCR 背后大层下载节点的链路不稳定**。现有正式部署链 `bash scripts/deploy/deploy-image.sh update` 只有“服务器直接 `docker pull` GHCR”这一条路，一旦这条路对大层拉取持续 `unexpected EOF`，生产更新就会卡死。

这意味着当前问题还不是根因修复，只是靠一次人工绕行把版本送上去了。若不调整正式部署分发链，后续发版仍可能再次卡在同一处。

## What Changes
- 为生产镜像部署新增一条**镜像流式输送 fallback**：
  - 在网络条件良好的构建机或 CI 上拉取目标镜像；
  - 使用 Docker 官方支持的镜像导出 / 导入能力，把镜像流式传到生产机；
  - 生产机只负责 `docker load` + 复用现有 `deploy-image.sh` 的启动、smoke、自动回退。
- 默认正式发布改为 CI 构建后直传生产机；保留当前“服务器直接拉 GHCR”和“本机输送”的显式 fallback，但不再把它们视为默认发布方式。
- 为部署脚本补充“已预装本地镜像时跳过拉取”的受控入口，避免 fallback 已经把目标镜像送到服务器后，脚本又重新回到失败的 GHCR 拉取环节。
- 新增 CI / 本地统一可执行的部署入口，支持：
  - 指定 tag；
  - CI 构建后通过 SSH 把镜像 tar 输送到生产机；
  - 本机输送 fallback；
  - 在生产机上复用现有 smoke / 回退链完成切换。
- 更新部署文档，明确：
  - 什么叫“根因修复”；
  - 什么叫“结构性规避”；
  - 以后默认应该怎么部署，什么情况下才回退到服务器直拉。

## Impact
- Affected specs:
  - `production-deployment-delivery`
  - `production-deployment-safety`
- Affected code:
  - `scripts/deploy/deploy-image.sh`
  - `scripts/deploy/*`（新增镜像输送脚本）
  - `.github/workflows/*`（如采用 CI 自动输送）
  - `docs/deploy.md`
