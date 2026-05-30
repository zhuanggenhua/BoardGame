# Change: 大杀四方余牌查询房间开关与大厅扩展摘要

## Why

大杀四方当前默认允许点击牌堆查看剩余牌信息，这会改变不同房间对信息公开程度的预期。与此同时，大厅房间列表没有展示房间启用的扩展，玩家在加入前无法快速判断这局是否符合自己的游玩偏好。

## What Changes

- 为大杀四方新增 `余牌查询` 房规项，作为与 `泰坦`、`DIY` 同组的多选项之一，默认关闭。
- 当 `余牌查询` 关闭时，牌库区仍显示当前剩余数量，但不能展开剩余牌详情。
- 当 `余牌查询` 开启时，保留现有的大杀四方牌库查看能力，并允许切到对手视角后查看当前视角玩家的余牌。
- 为大厅房间列表新增“已开启扩展”公开摘要，仅展示适合公开的扩展信息，不直接暴露整份 `setupData`。
- 房间扩展摘要中的 tag 直接显示完整扩展展示名。
- 为新的房间配置 UI 和大厅展示补充端到端测试与截图证据。

## Impact

- Affected specs: `smashup-room-options`, `lobby-room-summaries`
- Affected code:
  - `src/games/smashup/manifest.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/ui/DeckDiscardZone.tsx`
  - `src/components/lobby/CreateRoomModal.tsx`
  - `src/components/lobby/RoomList.tsx`
  - `src/components/lobby/GameDetailsModal.tsx`
  - `src/services/lobbySocket.ts`
  - `server.ts`
  - `e2e/smashup/*`
