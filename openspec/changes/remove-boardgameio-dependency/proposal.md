# Change: 移除 boardgame.io 依赖，自建轻量状态同步层

## Why

boardgame.io 在项目中已沦为"过度包装的 socket.io 中间人"。项目自建的引擎层（~10,500 行）已完全覆盖游戏逻辑管线（validate → execute → reduce），boardgame.io 仅提供 5 项能力：状态同步、房间管理 REST API、React Client 封装、LobbyClient、随机数。但它带来的问题远超收益：

1. **类型安全黑洞**：`moves` 类型为 `Record<string, (...args: any[]) => void>`，任何命令名都合法，`?.` 可选链静默跳过不存在的命令（rapid_fire bug 根因）
2. **server.ts 大量 hack**：`recreateRequestStream`（body 被重复读取）、`interceptLeaveMiddleware`（阻止自动 wipe）、bodyParser 冲突、CORS 覆盖——1,350+ 行中超过 800 行是绕过 boardgame.io 默认行为
3. **adapter.ts 胶水层**：430 行纯粹将引擎概念翻译成 boardgame.io 格式（Move ↔ Command、random 包装、playerID 解析）
4. **2MB 依赖体积**：包含大量未使用的功能（phases、stages、AI、plugins）
5. **ESM 兼容问题**：需要 `createRequire` hack 才能在 tsx 下正确导入

替换后预计：新增 ~550-730 行，删除 ~800+ 行 hack，净减少 ~200 行，同时获得完整类型安全。

## What Changes

- **BREAKING**：移除 `boardgame.io` npm 依赖
- **BREAKING**：`BoardProps` 类型替换为自建 `GameBoardProps`
- **BREAKING**：`moves` 对象替换为类型安全的命令分发函数
- 新建 `src/engine/transport/` — 基于 socket.io 的状态同步层（服务端 + 客户端）
- 重写 `server.ts` — 移除 BoardgameServer，直接使用 Koa + socket.io
- 重写 `MatchRoom.tsx` / `LocalMatchRoom.tsx` — 移除 boardgame.io Client，使用自建 React 封装
- 替换 `adapter.ts` — 简化为纯引擎入口（无 boardgame.io 翻译层）
- 替换 `LobbyClient` 调用 — 改为直接 fetch REST API
- 替换 `StorageAPI` — 保留 MongoDB 存储，移除 boardgame.io 接口适配
- 自建 `RandomFn` — 保留 `createSeededRandom`，移除 boardgame.io random 包装

## Impact

- 受影响 specs：`game-registry`（游戏注册类型变更）
- 受影响代码（按影响程度排序）：
  - `server.ts` — 全面重写
  - `src/engine/adapter.ts` — 全面重写
  - `src/pages/MatchRoom.tsx` — 重写客户端连接逻辑
  - `src/pages/LocalMatchRoom.tsx` — 重写本地模式
  - `src/core/types.ts` / `src/core/ui/types.ts` — 移除 boardgame.io 类型
  - `src/games/manifest.server.types.ts` / `manifest.client.types.ts` — 移除 Game/BoardProps
  - 所有 `Board.tsx`（4 个游戏 + UGC）— 替换 BoardProps 为自建类型
  - `src/hooks/match/useMatchStatus.ts` — 替换 LobbyClient
  - `src/pages/Home.tsx` / `src/contexts/RematchContext.tsx` — 替换 LobbyClient
  - `src/components/lobby/GameDetailsModal.tsx` / `GameDebugPanel.tsx` — 替换 LobbyClient
  - `src/server/storage/` — 移除 StorageAPI 接口
  - `src/server/claimSeat.ts` / `joinGuard.ts` / `offlineInteractionAdjudicator.ts` — 移除 boardgame.io 类型
  - `e2e/helpers/dicethrone.ts` — 替换 LobbyClient
  - `src/ugc/` — 替换 Client/BoardProps
