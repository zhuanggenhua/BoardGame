# Change: 彻底移除 R2 在线素材链路

## Why
当前实现仍是“服务器优先 + R2 回退”，线上访问、发布脚本和运维服务仍保留 R2 作为服务链路的一部分。用户目标已经调整为彻底脱离 R2：现有域名保持不变，但公开下载、应用更新、移动素材包和原生更新包都必须只由服务器素材源提供。

## What Changes
- **BREAKING**: `assets.easyboardgame.top/official/**` 不再从 R2 读取，也不再在源站失败时自动回退 R2。
- 公开素材域名切为灰云直连服务器 443；Cloudflare Worker 只保留为历史回滚/诊断入口，R2 bucket binding 从 Worker 配置移除。
- 素材上传、OTA、原生更新、移动素材包发布只写服务器 staging/release，并在公开域名验证服务器对象。
- 服务器不再生成 R2 灾备队列；R2 同步/备份 systemd 单元改为禁用的遗留入口。
- `npm run assets:*` 保持命令名不变，但内部切换到服务器发布脚本，避免协作者改流程。

## Impact
- Affected specs: `asset-routing`, `asset-manifest`
- Affected code: `infra/cloudflare/asset-router/`, `infra/server/asset-origin/`, `scripts/assets/`, `scripts/mobile/`, `package.json`
- Rollback: 代码层可恢复 R2 Worker/binding 与旧脚本；线上层可重新绑定历史 R2 路由，但不作为本变更完成态。
