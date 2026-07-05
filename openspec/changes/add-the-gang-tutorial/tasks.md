## 0. Approval Gate
- [x] 0.1 Approval Gate：`add-the-gang-tutorial` 的 proposal / design / tasks / spec delta 支持基础版完整闭环中的基础教程边界：目标、手牌、筹码选择、轮次推进、玩家区、摊牌和结束高亮锚点；扩展、Joker、工具牌、Dealer、挑战/专家卡和强策略教学属于后续范围。用户已明确本轮判断口径是“不是所有扩展，而是全部基本功能都能完成”，因此本 Approval Gate 关闭。

## 1. Implementation
- [x] 1.1 Add The Gang basic tutorial steps covering goal, hand, chip choice, round progress, showdown, and win/loss track
- [x] 1.2 Add Board tutorial bridge and highlight anchors
- [x] 1.3 Add zh-CN/en tutorial i18n strings
- [x] 1.4 Add tests for manifest integrity and Board anchors

## 2. Verification
- [x] 2.1 `openspec validate add-the-gang-tutorial --strict --no-interactive`
- [x] 2.2 `npx vitest run src/games/the-gang --configLoader native`
- [x] 2.3 `npx eslint src/games/the-gang --ext .ts,.tsx`
