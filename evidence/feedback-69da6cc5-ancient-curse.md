# 反馈 69da6cc5：远古诅咒埋葬翻开后消失

## 结论
- 根因：埋葬翻开 ongoing 且目标为随从、基地无随从时，`executeUncoveredAction` 仍发出 `ACTION_PLAYED(fromBuried)`，但未产生 `ONGOING_ATTACHED`，导致 `reduce(ACTION_PLAYED)` 把卡从 buried 移除且不进弃牌堆，出现“消失”。
- 修复：在 `uncoverBuriedCard` 中提前拦截该场景，改为 `BURIED_CARD_UNCOVERED(discardWithoutPlay:true)`，确保进入弃牌堆。

## 代码改动
- `src/games/smashup/domain/bury.ts`
- `src/games/smashup/__tests__/buryEngine.test.ts`

## 验证
- `npx vitest run src/games/smashup/__tests__/buryEngine.test.ts`

## 结果
- 新增用例验证：当埋葬翻开远古诅咒且基地无随从时，卡进入弃牌堆，未再“消失”。
