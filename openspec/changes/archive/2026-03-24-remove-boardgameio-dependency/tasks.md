> **状态：已完成**。旧框架（boardgame.io）已完全移除，自研传输层已全面接管。本文档保留为历史记录。

## 1. 类型层与传输层基础

- [x] 1.1 定义 `MatchStorage` 接口（`src/engine/transport/storage.ts`），替代旧存储接口
- [x] 1.2 定义 `GameBoardProps<TCore, TCommands>` 类型（`src/engine/transport/protocol.ts`），包含 `state`、`dispatch`、`playerId`、`isConnected`、`matchData`
- [x] 1.3 定义 `GameTransportEvents` socket.io 事件协议（`src/engine/transport/protocol.ts`）：`command`、`state:update`、`state:sync`、`error`
- [x] 1.4 实现 `GameTransportServer`（`src/engine/transport/server.ts`）：接收命令 → pipeline 执行 → playerView 过滤 → 广播状态
- [x] 1.5 实现 `GameTransportClient`（`src/engine/transport/client.ts`）：连接 `/game` namespace、发送命令、接收状态、自动重连
- [x] 1.6 实现 `useGameClient<TCore, TCommands>` Hook（`src/engine/transport/react.tsx`）：Context + Provider 封装
- [x] 1.7 实现 `LocalGameProvider`（`src/engine/transport/react.tsx`）：本地模式，无网络，直接执行 pipeline
- [x] 1.8 为传输层编写单元测试（连接、命令分发、状态同步、重连）

## 2. 服务端重写

- [x] 2.1 重写 `server.ts`：移除旧服务端，直接创建 Koa app + IOServer → `server.new.ts`（待重命名）
- [x] 2.2 实现房间管理 REST 路由（create/join/leave/destroy/claim-seat/getMatch），使用 `@koa/router`
- [x] 2.3 适配 `MongoStorage` / `HybridStorage` 到 `MatchStorage` 接口（`StorageAdapter`）
- [x] 2.4 将 `GameTransportServer` 挂载到 `/game` namespace
- [x] 2.5 保持大厅 socket（`/lobby-socket`）和重赛/聊天事件不变
- [x] 2.6 将离线交互裁决逻辑内置到 `GameTransportServer`（断线 → graceMs → 自动 CANCEL_INTERACTION）
- [x] 2.7 迁移归档逻辑到新架构（`archiveMatchResult` 直接使用 `MatchStorage`）
- [x] 2.8 服务端集成测试（创建房间 → 加入 → 执行命令 → 状态同步 → 离开）

## 3. 客户端重写

- [x] 3.1 重写 `MatchRoom.tsx`：使用 `GameProvider` + `useGameClient`
- [x] 3.2 重写 `LocalMatchRoom.tsx`：使用 `LocalGameProvider`
- [x] 3.3 替换 `LobbyClient` 调用为 `matchApi`（useMatchStatus/Home/RematchContext/GameDetailsModal/GameDebugPanel/MatchRoom）
- [x] 3.4 创建 `src/services/matchApi.ts` — 封装房间管理 REST 调用
- [x] 3.5 替换 `UGCSandbox.tsx` 中的旧 Client
- [x] 3.6 迁移 MatchRoom UGC 在线模式到 GameProvider

## 4. 游戏层适配

- [x] 4.1 更新 `src/core/types.ts`：`GameImplementation` 添加 `engineConfig` 字段，registry 自动从 `__adapterConfig` 提取
- [x] 4.2 更新 `src/core/ui/types.ts`：移除旧 `GameBoardProps` 和 `Ctx` re-export；`core/ui/hooks.ts` 和 `useGameBoard.ts` 移除 `Ctx` import
- [x] 4.3 更新 `manifest.client.types.ts`：移除 `BoardProps` import（`board` 类型改为 `ComponentType<Record<string, unknown>>`）；`core/types.ts` 同步更新
- [x] 4.4 重写 `adapter.ts`：移除旧 `Game`/`Move` 翻译层，简化为纯引擎入口（`createGameEngine`）
- [x] 4.5 逐个游戏替换 Board.tsx 的 `BoardProps` → `GameBoardProps`（tictactoe → dicethrone → summonerwars → smashup）
- [x] 4.6 移除 DiceThrone `resolveMoves.ts`（不再需要，dispatch 已类型安全）
- [x] 4.7 替换 SummonerWars Board.tsx 中所有 `moves[SW_COMMANDS.XXX]` 为 `dispatch(SW_COMMANDS.XXX, payload)`
- [x] 4.8 替换 UGC client/board 的旧依赖

## 4.9 补充完成项（本轮新增）

- [x] 4.9.1 `createUgcGame`（ugc-wrapper/game.ts）返回 `{ game, engineConfig }` 双产物，`buildUgcServerGames` 同步返回 `engineConfigs`
- [x] 4.9.2 `server.new.ts` UGC 游戏注册：从 TODO 变为实际注册 `engineConfigs`（消除 UGC 引擎缺失问题）
- [x] 4.9.3 `createGameEngine` 从 `engine/index.ts` barrel 导出
- [x] 4.9.4 UGC client/game.ts：`createGameFromRules` 返回 `engineConfig`，`createUgcClientGame`/`createUgcDraftGame` 透传
- [x] 4.9.5 `MatchRoom.tsx` / `UGCSandbox.tsx`：UGC 分支直接使用返回的 `engineConfig`，移除 `__adapterConfig` 提取和 `createGameEngine` import
- [x] 4.9.6 UGC client/board.tsx：`BoardProps` → `GameBoardProps`，移除旧依赖，`moves` → `dispatch`

## 5. 测试与清理

- [x] 5.1 更新 `e2e/helpers/dicethrone.ts`：替换 LobbyClient 为直接 HTTP 调用 `/games/dicethrone/create`
- [x] 5.1.1 切换默认启动入口：`nodemon.json` exec → `server.new.ts`，`package.json` dev:un/dev:lite → `server.new.ts`，`Dockerfile.game` CMD → `server.new.ts`- [x] 5.2 更新服务端测试（claimSeat.test.ts、joinGuard.test.ts、offlineInteractionAdjudicator.test.ts 等）：移除旧类型
- [x] 5.3 运行全量测试（`npm test` + `npm run test:e2e`），确保无回归
- [x] 5.4 从 `package.json` 移除旧依赖
- [x] 5.5 删除 `src/engine/adapter.ts` 中的旧代码（`createGameAdapter` 已移除，adapter.ts 仅保留 `createGameEngine` 和 `createReplayAdapter`）
- [x] 5.6 全局 grep 确认无残留旧 import
- [x] 5.7 更新 `openspec/project.md` 技术栈描述
- [x] 5.8 更新 `AGENTS.md` 相关规则（移除旧框架相关约束，更新架构描述）
