# Change: 服务器主源素材分发收口

## Why
- 旧方案曾把 `assets.easyboardgame.top` 从对象存储直出切到“服务器主源 + 对象存储回退”，但当前目标已经调整为彻底脱离对象存储在线链路。
- 继续保留“回退成功”“灾备队列”“容量门禁”等活跃规范，会让发布脚本、OTA 验收和后续排查重新回到旧链路，导致更新失败被误判为可用或被静默降级。
- 当前生产资源链路必须只有一个线上真相源：服务器活动版本。服务器不可读、清单不可读、跨域预检失败或哈希不一致，都必须显式失败，不能包装成“没有更新”或“回退成功”。

## What Changes
- 保持 `https://assets.easyboardgame.top/official/...` 公开地址和协作者命令名不变，但正式素材、应用更新、移动素材包和原生更新包只从服务器活动版本提供。
- Cloudflare Worker 只负责域名、CORS、诊断响应头和隐藏源代理；源站失败返回可观测错误，不读取对象存储同 key 对象。
- 发布脚本通过受限 SSH 写入服务器 staging，校验路径、大小、哈希和清单引用后原子切换 `current`。
- 发布成功判据必须绑定公开域名上的服务器对象：`X-Asset-Source: server`、正文大小、SHA-256 和必要的 CORS `OPTIONS` 预检。
- Android OTA、移动素材包、原生更新和后台发布页不得再使用对象存储配置作为 ready 门禁；服务器发布入口不可用时必须阻塞发布并报告原因。
- 历史对象存储清理、灾备队列、容量门禁和回传恢复不再属于本变更交付范围；如需删除历史对象，必须另开只处理历史清理的变更并先确认恢复边界。

## Impact
- Affected specs:
  - `asset-routing`
  - `asset-manifest`
  - `ai-training-data`
- Affected systems:
  - Cloudflare Worker asset router
  - 生产服务器 Nginx 静态源、release/current 目录和发布脚本
  - Android OTA、移动素材包、原生更新发布脚本
  - 后台发布页和部署 runner ready 状态
- Expected repository areas:
  - `infra/cloudflare/asset-router/`
  - `scripts/assets/`
  - `scripts/mobile/`
  - `scripts/deploy/`
  - `docs/deploy.md`
  - `docs/ai-rules/asset-pipeline.md`
  - `.codex/skill/android-app-release/SKILL.md`
