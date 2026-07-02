# Change: Add tutorial progress resume

## Why
教程刷新后会从头开始，玩家在长教程或多章节教程中容易丢失当前教学局面。

## What Changes
- 让教程运行时复用本地对局快照保存章节内局面与步骤进度。
- 刷新后如存在可恢复进度，先弹窗让玩家选择继续或重头开始。
- 多章节教程按游戏与章节独立保存进度，互不覆盖。
- 教程完成后清理对应章节进度，避免完成后再次提示恢复。

## Impact
- Affected specs: tutorial-engine
- Affected code: `src/pages/useMatchRoomTutorialLifecycle.tsx`, `src/pages/matchRoomTutorialStageRuntime.tsx`, `src/pages/useMatchRoomPageRuntimeModel.ts`, `src/pages/matchRoomStageRuntimeModelBuilders.ts`
