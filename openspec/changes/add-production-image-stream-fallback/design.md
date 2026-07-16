## Context
当前生产正式链路的分发阶段只有一种做法：生产机自己从 GHCR 拉取目标镜像。实际事故已经证明，这条链路对 `ghcr.io` 背后的大层下载节点并不稳定，且 Docker 的 `registry-mirrors` 配置本身主要针对 Docker Hub 体系，不能把“生产机到 GHCR 大层下载链路不稳”自动修好。

本次应急成功上线依赖的是另一条链路：在网络更好的机器上完成前端产物 / 镜像准备，再把结果送到生产机本地使用。这说明**真正需要收口的是“分发方式”，不是继续赌生产机外网拉大层会恢复**。

## Goals / Non-Goals
- Goals:
  - 提供仓库内正式支持的免费 CI 直传链路，让生产部署不再单点依赖“服务器直拉 GHCR 大层”或“本机先拉 GHCR”。
  - 复用现有 `deploy-image.sh` 中已经存在的启动、smoke、自动回退能力，而不是另起一套平行门禁。
  - 让 CI 或本地运维机都能执行同一套镜像输送入口，减少手工临时拼命令。
- Non-Goals:
  - 不在本变更里修复公网运营商、CDN 或 GitHub 网络出口本身。
  - 不在本变更里替换掉 GHCR 作为镜像仓库。
  - 不把“本机重建前端产物”保留为未来常态；长期应优先输送完整镜像，而不是每次重新散装组装。

## Decisions
- Decision: 默认正式部署改为“CI 构建后直传镜像”，以 Docker 官方镜像导出 / 导入能力为核心。
  - Why: 它同时绕开生产机到 GHCR 大层下载不稳、以及本机先拉 GHCR 造成的慢点，同时仍然保持镜像作为生产交付物。
- Decision: 保留本机镜像输送作为 fallback，不再作为默认发布路径。
  - Why: 已测到本机拉 GHCR 会成为主要耗时，默认路径不能继续依赖它。
- Decision: fallback 只解决“镜像分发”，服务切换仍统一交给 `deploy-image.sh`。
  - Why: 这样既有 smoke、自动回退、部署状态记录都不用重写，避免产生第二套发布逻辑。
- Decision: 为 `deploy-image.sh` 增加受控的“跳过 pull”能力，而不是简单粗暴全局环境变量绕过。
  - Why: 需要精确表达“目标镜像已在本地就绪，所以跳过拉取”，不能把它做成泛化逃生开关。

## Alternatives Considered
- 继续依赖 `configure-mirror` / `registry-mirrors`
  - Rejected: 它不能从根上解决生产机到 GHCR 大层下载节点不稳的问题。
- 让生产机本地重建完整 web 镜像
  - Rejected: 这次已经证实前端构建在生产机上会被内存杀死，不能当正式常态。
- 改用另一家公网镜像仓库
  - Deferred: 仍然依赖生产机外网拉大层，且涉及新的凭据、同步、镜像治理，不是最小可落地解。

## Risks / Trade-offs
- 需要维护 SSH 输送入口与服务器认证信息。
  - Mitigation: 优先复用现有生产 SSH 入口与 GitHub Actions secret，不引入新付费服务。
- 镜像输送会占用 CI runner 上传时间。
  - Mitigation: 只在需要 fallback 或正式部署 job 中执行，不影响普通构建 job。
- 若输送完成后部署脚本没有可靠跳过 pull，仍可能回到原失败点。
  - Mitigation: 将“本地目标镜像已就绪”设计成明确参数并纳入验证。

## Migration Plan
1. 增加 spec / proposal，确认 fallback 是正式能力。
2. 实现镜像输送脚本与 `deploy-image.sh` 的 skip-pull 受控入口。
3. 接入 CI 与统一命令入口，默认由 `deploy-and-ota` 触发 CI 直传。
4. 通过一次受控部署验证“输送 → 启动 → smoke → 验证”完整路径。
5. 更新文档，把“服务器直拉 GHCR”从唯一正式路径调整为“主路径之一”。

## Open Questions
- 无。当前裁决：默认改为 CI 直接输送生产机；本机输送和服务器直拉只作为显式 fallback；每次统一输送 `web + game-server` 两个业务镜像以保持版本切换一致。
