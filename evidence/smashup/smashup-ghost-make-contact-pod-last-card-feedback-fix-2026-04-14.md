# Smash Up 交朋友（POD）最后一张手牌修复证据（2026-04-14）

## 反馈信息
- feedbackId: 69daf81e469c37573d131c16
- conflictKey: smashup::ghost-befriend-last-card
- 现象: 仅剩最后一张“交朋友（POD）”时仍未生效，直接进入弃牌。

## 根因与修复摘要
- 根因：ghost_make_contact_pod 使用 player.hand.length > 0 判断手牌，未排除正在打出的卡，导致“最后一张手牌”也被误判为仍有手牌，从而自毁。
- 修复：改为使用 handSizeAfterPlay 或过滤掉当前卡的手牌数量判定，确保仅当打出后仍有手牌才自毁。

## 变更文件
- src/games/smashup/abilities/ghosts.ts
- src/games/smashup/__tests__/ghostsAbilities.test.ts

## 验证记录
- 
px eslint src/games/smashup/abilities/samurai.ts src/games/smashup/abilities/ghosts.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/ghostsAbilities.test.ts
- 
px vitest run src/games/smashup/__tests__/ghostsAbilities.test.ts -t "ghost_make_contact_pod"

## 结论
- 交朋友（POD）在仅剩最后一张时可以正确转移控制权；若仍有其他手牌则按规则自毁。
