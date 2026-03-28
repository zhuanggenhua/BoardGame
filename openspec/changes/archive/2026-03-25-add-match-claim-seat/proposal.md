# Change: 登录用户回归单房间对局（claim-seat）

## Why
当前单房间限制依赖 ownerKey，但回归需要本地 credentials。一旦本地凭据丢失，登录用户会“既不能新建，也进不去旧房间”。需要提供服务端可信回归路径，保持“一人一房 + gameover 仍占用”的语义，同时允许游客房间被新建覆盖。

## What Changes
- 新增 `POST /games/:name/:matchID/claim-seat`：登录用户携带 JWT 回归旧房间并重新签发 credentials。
- 单房间限制保持：`gameover` 仍算占用，创建房间时仍会返回 `ACTIVE_MATCH_EXISTS`。
- 游客 ownerKey 创建房间时，如果已有占用房间则删除旧房间并允许新建（游客房间不长期保存）。
- 前端在 `ACTIVE_MATCH_EXISTS` 时自动走回归流程（无本地凭据也可回归）。

## Impact
- Affected specs: `match-ownership`（新增能力）
- Affected code: `server.ts`, `src/server/storage/MongoStorage.ts`, `src/components/lobby/GameDetailsModal.tsx`, `src/pages/Home.tsx`, `src/hooks/match/useMatchStatus.ts`
- Tests: server 侧路由/存储测试 + 前端回归流程单测
