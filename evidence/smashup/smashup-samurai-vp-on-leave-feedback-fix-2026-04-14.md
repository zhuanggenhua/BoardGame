# Smash Up 武士 5 力量离场得分修复证据（2026-04-14）

## 反馈信息
- feedbackId: 69daf84d469c37573d131c18
- conflictKey: smashup::samurai-vp-on-leave
- 现象: 武士（Bushi）力量≥5 离场未获得 1VP。

## 根因与修复摘要
- 根因：POD 版本 samurai_bushi_pod 未注册 onMinionDestroyed/onMinionDiscardedFromBase 触发器，导致 5 力量离场不发 VP 事件。
- 修复：在 egisterSamuraiAbilities 中补齐 POD 版本触发器：
  - samurai_samurai_chan_pod / samurai_bushi_pod / samurai_shogun_pod / samurai_final_haiku_pod / samurai_honor_the_fallen_pod。

## 变更文件
- src/games/smashup/abilities/samurai.ts

## 验证记录
- 
px eslint src/games/smashup/abilities/samurai.ts src/games/smashup/abilities/ghosts.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/ghostsAbilities.test.ts
- 
px vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "samurai_final_haiku_pod|samurai_bushi_pod"

## 结论
- POD 版武士离场触发已恢复，符合“力量≥5 离场得 1VP”的预期。
