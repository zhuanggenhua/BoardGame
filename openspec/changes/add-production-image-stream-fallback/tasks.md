## 1. Proposal
- [x] 1.1 明确“服务器直拉 GHCR”与“镜像流式输送 fallback”的切换条件
- [x] 1.2 明确 fallback 与现有 smoke / 自动回退链的复用边界
- [x] 1.3 明确未来默认发布入口是 CI 自动输送、手工触发输送，还是两者并存

## 2. Implementation
- [x] 2.1 为生产部署脚本增加“本地目标镜像已就绪时跳过 pull”的受控入口
- [x] 2.2 新增镜像输送脚本：在构建机/CI 拉取目标镜像并通过 SSH 流式导入生产机
- [x] 2.3 将输送后的服务切换接入现有 `deploy-image.sh` smoke / 自动回退链
- [x] 2.4 如采用 GitHub Actions，新增或更新 workflow，形成仓库内正式自动化入口
- [x] 2.5 更新 `docs/deploy.md`，写清默认链路、fallback 条件、排障口径

## 3. Validation
- [x] 3.1 运行 `openspec validate add-production-image-stream-fallback --strict --no-interactive`
- [ ] 3.2 在受控环境验证一条“服务器直拉失败 → 镜像输送 fallback 成功”的完整路径
- [x] 3.3 验证 fallback 场景下仍会执行既有 smoke 与自动回退
