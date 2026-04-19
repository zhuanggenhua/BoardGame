# Smash Up 终曲俳句（POD）+2 效果修复证据（2026-04-14）

## 反馈信息
- feedbackId: 69daf7bb469c37573d131c14
- conflictKey: smashup::samurai-ongoing-plus-two-after-chain
- 现象: 装备“终曲俳句（POD）”的随从被消灭后，未触发其他己方随从 +2 的效果。

## 根因与修复摘要
- 根因：samurai_final_haiku_pod 未注册 destroy/discard 触发器，导致随从离场时未触发 +2 临时力量事件。
- 修复：在 egisterSamuraiAbilities 中补齐 samurai_final_haiku_pod 的触发器（与非 POD 版逻辑一致）。

## 变更文件
- src/games/smashup/abilities/samurai.ts
- src/games/smashup/__tests__/newFactionAbilities.test.ts

## 验证记录
- 
px eslint src/games/smashup/abilities/samurai.ts src/games/smashup/abilities/ghosts.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/ghostsAbilities.test.ts
- 
px vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "samurai_final_haiku_pod|samurai_bushi_pod"

## 结论
- POD 版终曲俳句在随从离场后可以正确触发己方随从 +2 的临时力量。
