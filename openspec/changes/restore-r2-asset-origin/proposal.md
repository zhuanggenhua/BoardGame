# Change: 恢复 R2 官方素材主源

## Why
线上用户反馈变卡后，生产排查显示游戏服务出现过接近满核的 CPU 尖峰，同时官方素材域名当前仍从服务器素材源返回内容。素材下载、移动包下载、发布写入和游戏服务继续共用同一台小规格生产机，会把 CPU、带宽、磁盘和 IO 压力叠在一起。

此前切到服务器主源的直接原因是对象存储空间不足；本次目标是在先清理无效历史对象和服务器冗余数据的前提下，把玩家素材下载主源搬回 R2，让游戏/API 服务不再与素材分发竞争同机资源。

## What Changes
- 保持公开资源基址 `https://assets.easyboardgame.top/official` 不变，但将 `official/**` 的默认玩家下载主源恢复为 R2。
- 恢复或重建 R2 发布链路，覆盖普通素材、manifest、file-index、OTA 包、原生更新包和移动素材包。
- 将现有“禁止 R2 运行时入口”的审计改为“R2 主源必须可验证，服务器源不能作为默认玩家下载路径”的审计。
- 清理流程先做对象图和磁盘占用盘点，只删除已证明不被当前 manifest、latest 指针、移动包 file-index、数据库/Redis/训练数据引用的旧数据。
- 服务器素材源仅允许作为迁移期回滚或受控应急路径，不再作为默认完成态。

## Impact
- Affected specs: `asset-routing`, `asset-manifest`
- Affected code: asset publish scripts, mobile OTA/package publish scripts, Cloudflare Worker/Wrangler config, deployment docs, asset runtime audits
- Operational impact: requires Cloudflare/R2 credentials outside the repo, DNS/Worker switch, production URL verification, and a cleanup dry-run before destructive deletion
