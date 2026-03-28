## Context
- 单房间限制依赖 `ownerKey`（写入 `metadata.setupData.ownerKey`）。
- 旧框架的重新进入需要 `playerID + credentials`，本地凭据丢失会导致回归失败。
- 用户确认：`gameover` 仍算占用；游客房间不需长期保存；游戏服需验证 JWT。

## Goals / Non-Goals
- Goals:
  - 登录用户可在无本地凭据时回归旧房间（跨设备/清缓存）。
  - 保持“一人一房”，`gameover` 仍视为占用。
  - 游客房间可被新建覆盖，避免卡死。
- Non-Goals:
  - 不支持同一 ownerKey 并存多个房间。
  - 不新增长期保留/归档策略。

## Decisions
- Decision: 新增 `POST /games/:name/:matchID/claim-seat`，仅允许携带 JWT 的登录用户回归。
  - 认证方式：使用 `JWT_SECRET` 验证 Bearer Token，并提取 userId。
  - 授权规则：`metadata.setupData.ownerKey === user:${userId}` 才能回归。
  - 行为：重新签发该 playerID 的 credentials，并更新 `metadata.players[playerID]`。
- Decision: 游客 ownerKey 创建房间时，如果已存在占用房间，则删除旧房间再创建新房间。
  - 仅对 `ownerKey` 前缀 `guest:` 生效。
  - 旧房间删除使用 `db.wipe`。

## Risks / Trade-offs
- 安全风险：JWT 校验逻辑必须与 API 保持一致，避免伪造。
- 体验权衡：游客房间可能被新建覆盖（符合“游客房间不长期保存”）。

## Migration Plan
- 先上线 claim-seat 路由，再切换前端回归流程。
- 观察回归成功率与日志，确认无异常后再清理旧逻辑。

## Open Questions
- 无（用户已确认关键语义）。
