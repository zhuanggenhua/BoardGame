# Change: 为 Splendor 添加开始游戏门槛

## Why
`splendor` 当前在联机房间中只要棋盘已渲染，当前玩家就可能直接执行拿宝石、保留、购买等操作。
这会导致“对手尚未加入”或“房主尚未点开始游戏”时，已经进入实际玩法流程，不符合联机房间的预期体验。

## What Changes
- 为 `splendor` 增加显式的“已开始”状态（`hostStarted`）。
- 增加 `HOST_START_GAME` 命令与 `HOST_STARTED` 事件。
- 在开始前从领域层拒绝玩法命令（拿取、保留、购买、选贵族等）。
- `splendor` Board 在开始前显示等待/开始覆盖层；房主可点击开始，其他玩家只显示等待。
- 补充对应文案与测试，确保开始前不能进行实际玩法操作。

## Impact
- Affected specs: 新增 `splendor-start-gate` capability
- Affected code:
  - `src/games/splendor/domain/types.ts`
  - `src/games/splendor/domain/index.ts`
  - `src/games/splendor/domain/commands.ts`
  - `src/games/splendor/domain/reducer.ts`
  - `src/games/splendor/game.ts`
  - `src/games/splendor/Board.tsx`
  - `public/locales/zh-CN/game-splendor.json`
  - `public/locales/en/game-splendor.json`
  - `src/games/splendor/__tests__/smoke.test.ts`
