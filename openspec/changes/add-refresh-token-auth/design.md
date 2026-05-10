## Context
当前认证为单一 JWT，登录/注册签发后长期复用，导致过期或密钥轮换时必须重新登录，且无法细粒度撤销。目标是引入商业级的 Access/Refresh 体系以提升体验与安全性。

## Goals / Non-Goals
- Goals:
  - Access Token 短期有效（建议 15–30 分钟）
  - Refresh Token 长期有效（当前项目采用 180 天，降低低频玩家反复登录）
  - Refresh 轮换与复用检测
  - 401 自动刷新一次并重试请求
- Non-Goals:
  - 不引入第三方 OAuth
  - 不改动游戏服务的鉴权入口语义（仍校验 Access Token）

## Decisions
- Access Token 由登录/注册与 refresh 接口返回；Refresh Token 通过 httpOnly Cookie 下发。
- Refresh Token 在服务端持久化（Redis/DB），仅存哈希与元信息（userId、过期时间、轮换链）。
- Refresh 复用检测：旧 Refresh 被使用即判定异常，撤销该用户全部 Refresh。
- 登出时撤销当前 Refresh，并保留 Access 黑名单逻辑。

## Alternatives considered
- 延长 Access Token TTL（简单但安全性差）
- Session Cookie（与现有 JWT 模型冲突，改动过大）

## Risks / Trade-offs
- Cookie 策略（SameSite/secure）需要按环境配置，否则本地开发可能无法携带。
- 引入 refresh 需要并发控制，避免并行请求触发多次刷新。

## Migration Plan
1) 灰度开启：先允许 Access Token 仍从登录/注册返回。
2) 新增 refresh 接口并在前端切换自动刷新。
3) 验证通过后，将 Access Token TTL 缩短并强制 refresh 续签。

## Open Questions
- Refresh Token 存储使用 Redis 还是 MongoDB？
- Cookie SameSite 策略是否统一为 Lax（生产环境是否需要 None + Secure）？
- Refresh TTL 最终标准：当前采用 180 天；后续若引入“记住我”开关，可再拆分普通会话与长期会话。
