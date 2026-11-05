# 认证 401 / Token 排查

本页只处理登录态相关 401，例如创建房间、调用后台或社交接口时返回 `Invalid token` / `Unauthorized`。

## 先分清对象

| 对象 | 现实含义 | 主源 |
| --- | --- | --- |
| Access Token | 前端保存在 `localStorage.auth_token` 的登录凭证，当前有效期 30 天 | [`apps/api/src/modules/auth/auth.service.ts`](../../apps/api/src/modules/auth/auth.service.ts) |
| Refresh Token | API 通过 httpOnly cookie 维持的设备级续签凭证；Cookie 与 Mongo 会话均按活动滚动延长 400 天，服务端无固定绝对期限 | [`apps/api/src/modules/auth/auth.service.ts`](../../apps/api/src/modules/auth/auth.service.ts) |
| 自动刷新 | 页面启动 `/me` 遇 401、恢复可见或 Access Token 将过期时，通过 `/auth/refresh` 恢复 | [`src/hooks/useTokenRefresh.ts`](../../src/hooks/useTokenRefresh.ts) 与 [`src/contexts/AuthContext.tsx`](../../src/contexts/AuthContext.tsx) |
| 请求头 | 需要认证的请求必须携带 `Authorization: Bearer <token>` | 调用端源码和浏览器 Network |

## 快速判断

| 现象 | 最可能原因 | 下一步 |
| --- | --- | --- |
| 浏览器没有 `auth_token` | 未登录、被清缓存，或 refresh cookie 也失效 | 重新登录；若预期能自动恢复，查 `/auth/refresh` |
| `debug-token` 显示过期 | Access Token 超过 30 天 | 等自动刷新或重新登录 |
| `debug-token` 显示签名无效 | API / 游戏服 `JWT_SECRET` 不一致，或 token 是旧密钥签发 | 跑 `npm run check:jwt`，统一环境变量并重启服务 |
| Network 里没有 `Authorization` | 前端调用没有传 token，或 localStorage 读取失败 | 查对应请求的调用端 |
| Header 有 token 但服务仍拒绝 | token 被截断、密钥不一致、服务器时间异常或服务没读到新环境 | 用诊断脚本和服务日志交叉确认 |

## 排查命令

浏览器控制台：

```js
const token = localStorage.getItem('auth_token');
console.log({ hasToken: Boolean(token), length: token?.length });
```

本地终端：

```bash
node scripts/debug-token.mjs <token>
npm run check:jwt
node scripts/diagnose-auth.mjs <token>
```

浏览器 Network 只看三件事：

1. 失败请求是不是目标接口。
2. Request Headers 是否有 `Authorization: Bearer <token>`。
3. Response 是过期、签名失败、无权限，还是服务不可达。

## 修复入口

| 结论 | 最小动作 |
| --- | --- |
| 用户登录态失效 | 清掉本地 token 后重新登录 |
| `JWT_SECRET` 不一致 | 保留一个 `.env` 真相源，确保 API 和游戏服读取同一值，然后重启 |
| refresh 失败 | 查 `/auth/refresh`、cookie、API 是否启用，以及 [`useTokenRefresh`](../../src/hooks/useTokenRefresh.ts) |
| 前端没带请求头 | 查具体调用端，例如 [`src/services/matchApi.ts`](../../src/services/matchApi.ts) 或对应页面组件 |
| 服务端拒绝 token | 查 [`server.ts`](../../server.ts) 和 API 鉴权 guard 的验证逻辑 |

## 长期登录边界

- MongoDB 是活跃 Refresh 会话的持久真相源；API 进程重启和缓存清理不应清除已迁入 MongoDB 的会话。会话 400 天不活跃后会过期清理。
- 同账号不同设备各自独立；当前设备退出只撤销当前会话，修改或重置密码撤销该用户全部 Refresh 会话。
- 改密/重置密码撤销所有 Refresh 会话，但已签发的 Access JWT 目前没有集中即时吊销机制，仍可能有效至 30 天到期；不要把 Refresh 撤销描述为所有旧 Access Token 立即失效。
- 浏览器持久 Cookie 的期限不是无限期，浏览器/系统可清理站点数据；“永久登录”无法作此保证。
- 当前公网 HTTP 入口不提供传输加密。`HttpOnly` 不能防止网络链路窃听，不应在不可信网络使用长期登录凭证；达到商业生产的传输安全仍需 HTTPS。

## 不要把这些当成根因

- “401 消失了”只说明当前请求不再被拒绝；真实修复要回到原失败动作验证。
- “重新登录好了”只能说明旧登录态不可用；若频繁复发，还要查 refresh、密钥和服务器时间。
- “日志少了”不是修复证据；要确认真实接口成功执行。
