## Context
此前方案把服务器作为主源，把 R2 作为自动兜底和灾备。该方案缓解了访问慢，但没有满足“彻底脱离 R2”的目标，而且 R2 容量已接近零付费上限。

## Goals / Non-Goals
- Goals: 当前域名不变；线上下载只走服务器；发布脚本只写服务器；协作者命令名不变；源站错误要可观测。
- Non-Goals: 本变更不删除 R2 历史对象；不迁移所有历史包到服务器；不引入付费 Cloudflare 产品。

## Decisions
- 公开玩家下载入口必须是 `assets.easyboardgame.top` 灰云直连服务器 443；Worker 保留为历史回滚/诊断路径，不再作为完成态玩家下载路径，也不再绑定 R2。
- 服务器 `/home/admin/storage/assets/current` 是公开素材唯一线上真相源。
- `assets:upload` 切到服务器发布入口，继续复用受限 SSH + staging manifest + 原子 current 切换。
- 源站连接失败返回 `502` 和 `X-Asset-Source: server-error`，不伪装为回退成功。

## Risks / Trade-offs
- 服务器故障时素材域名会失败，不再由 R2 自动兜底；这是彻底脱离 R2 的直接代价。
- 必须确保服务器限流、磁盘保护和 release 裁剪可靠，避免素材下载影响游戏/API。
- 旧客户端若引用历史包，必须保证被清单递归引用的当前/兼容包仍在服务器 current 中。

## Migration Plan
1. 本地代码切换为服务器唯一源并通过定向测试。
2. 部署服务器控制脚本和 systemd 单元，禁用 R2 备份 timer。
3. 部署服务器 443 直连素材入口，并将 `assets.easyboardgame.top` DNS 切成灰云 A 记录。
4. 部署无 R2 binding 的 Worker 作为回滚/诊断入口，并确认完成态玩家请求不再命中 Worker。
5. 验证普通素材、OTA latest、原生更新 latest、移动素材包 manifest 和实际包都从当前域名直连服务器返回。
6. 确认停用/撤除 R2 凭证后公开域名仍可访问当前对象。

## Open Questions
- R2 历史对象何时删除需要用户单独确认；本变更只移出线上链路。
