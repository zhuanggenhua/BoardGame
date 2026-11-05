# Change: 引入持久化的多设备 Refresh Token 会话

## Why
当前系统已实现 Refresh Token 自动续签，但会话记录仍放在通用缓存中，并以用户为单位只保留一个当前令牌。新设备登录可能撤销旧设备会话；刷新并发或旧令牌重放可能撤销该用户的会话。未配置 Redis 时缓存还是进程内存，服务重启会直接丢失记录。另一个已确认的不一致是密码修改只更新密码、不撤销 Refresh Token，而密码重置会撤销。

本 change 在既有续签能力上补齐真正的会话持久性和撤销语义。它针对代码中确认的设计风险；当前没有线上请求日志或用户浏览器证据，不能据此断言某一次“十几天掉线”的唯一根因。

## What Changes
- 登录/注册继续返回现有 Access Token，并下发 httpOnly Refresh Token Cookie。
- 新增 `/auth/refresh`：使用 Refresh Token 轮换并签发新的 Access Token。
- Refresh 会话改由 MongoDB 持久保存哈希和会话状态，不依赖有 TTL 的通用缓存或 API 进程内存。
- 同一账号允许多个浏览器/设备各自维持会话；一个设备登录、退出或刷新不影响其它设备。
- 活跃会话不设服务端绝对到期时间；持久 Cookie 在续签时滚动延长。退出、改密/重置密码和明确安全撤销仍会结束对应会话。
- Refresh 轮换使用原子会话状态转换与跨标签页协调；并发旧令牌只影响该设备会话，不撤销整个账号的其它会话。
- 兼容已有 Redis/缓存中的 Refresh Token：用户首次续签时迁移到持久会话，避免发布时统一强制重新登录。
- 页面启动时 `/auth/me` 遇到过期 Access Token 401，会尝试 Refresh 并用新 Access Token 重试用户恢复；后台到期/页面恢复刷新继续沿用现有入口。跨标签迟到的旧响应不得清除已更新的会话。

## Impact
- Affected specs: `backend-platform`
- Affected code: `apps/api/src/modules/auth/*`, `src/hooks/useTokenRefresh.ts`、认证上下文和认证回归测试、认证 API 文档

## 明确边界
- “永久保存”指服务端活跃会话没有固定绝对寿命、且浏览器持久 Cookie 按成功续签滚动续期；不是不可撤销，也不是浏览器永不删除 Cookie 的保证。
- 用户清除 Cookie/站点数据、浏览器/系统淘汰站点数据、长时间不再续签、主动退出或安全撤销后，仍可能需要重新登录。
- 目前指定的公网 HTTP 地址不提供传输加密。`HttpOnly` 不能防止网络链路窃听；通过 HTTP 传输的长期 Refresh Cookie 和 Access Token 存在被窃取风险。本 change 不把 HTTP 描述为安全传输，也不以无限期凭证掩盖该风险。
