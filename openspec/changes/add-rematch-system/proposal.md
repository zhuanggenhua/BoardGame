# Change: 引擎级 RematchSystem（双方投票同房重开）

## Why
当前"再来一局"功能直接调用 `lobbyClient.playAgain` 创建新 match，导致旧 match 被删除，另一方玩家因 `useMatchStatus` 轮询旧 ID 返回 404 而被自动退出。此外，该逻辑仅在 TicTacToe 的 Board 组件中实现，无法跨游戏复用。

## What Changes
- **新增 RematchSystem**：引擎层系统，管理双方投票状态与重开触发
- **新增 RematchState**：`G.sys.rematch` 存储投票信息
- **新增 VOTE_REMATCH 命令**：玩家投票/取消投票
- **新增 RematchActions 组件**：通用 UI，显示投票状态与按钮
- **BREAKING**：移除 TicTacToe 中基于 `lobbyClient.playAgain` 的旧逻辑
- 重开使用 boardgame.io 的 `reset()` 函数，在同一 match 内重置状态

## Impact
- Affected specs: `game-registry`（新增 rematch 系统支持声明）
- Affected code:
  - `src/engine/types.ts`（RematchState 类型）
  - `src/engine/systems/RematchSystem.ts`（新系统）
  - `src/engine/systems/index.ts`（导出与默认系统）
  - `src/components/game/RematchActions.tsx`（通用 UI）
  - `src/games/tictactoe/Board.tsx`（移除旧逻辑，使用新系统）
  - `public/locales/*/common.json`（通用 rematch 文案）
