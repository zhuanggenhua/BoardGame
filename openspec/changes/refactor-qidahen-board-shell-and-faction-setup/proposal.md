# Change: 纠偏《七大恨》牌桌壳层与开局阵营确认

## Why
《七大恨》当前仍把地图 Scene、固定 `1920x1080` 舞台和全部 HUD 放在同一个缩放容器里，宽屏只能在固定舞台外补图，地图点击与 HUD 位置也因此互相牵连。联机开局在房主确定剧本后直接按座位顺序把玩家绑定到大明、蒙古、后金，没有玩家可见的阵营确认步骤，随后的人物与军备选择容易被误读成“选到了别人的内容”。

## What Changes
- 把《七大恨》牌桌拆成铺满真实 viewport 的地图 Scene 与独立缩放的 HUD，`1920x1080` 只保留为内部设计尺寸。
- 移除固定舞台外补图的实现语义，让真实地图 Scene 自己覆盖宽屏，HUD 不再参与 Scene 裁切。
- 在局内剧本确定后增加阵营确认阶段；玩家只能确认一个当前剧本可用且未被其他玩家占用的阵营。
- 阵营全部确认后再开放该阵营的人物与军备前置，并让私有视图始终跟随已确认的玩家阵营。
- 保持突袭作战在支付预览阶段可直接点击合法地图领土并更换目标。

## Impact
- Affected specs: `qidahen-online-board-flow`, `qidahen-board-layout`
- Affected code:
  - `src/games/qidahen/Board.tsx`
  - `src/games/qidahen/QidahenBoardShell.tsx`
  - `src/games/qidahen/domain/types.ts`
  - `src/games/qidahen/domain/commands.ts`
  - `src/games/qidahen/domain/scenarioVoteState.ts`
  - `src/games/qidahen/domain/factionSelectionState.ts`
  - `src/games/qidahen/domain/resolvedCommandEventBuilders.ts`
  - `src/games/qidahen/domain/resolvedEventReducers.ts`
  - `src/games/qidahen/__tests__/scenarioVote.test.ts`
  - `e2e/qidahen/online-inmatch-setup.e2e.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`
