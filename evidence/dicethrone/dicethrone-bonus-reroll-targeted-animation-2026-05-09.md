# DiceThrone 奖励骰重投定向动画修复证据（2026-05-09）

## 问题

- 现象：奖励骰重投特写里只选择了 1 颗骰子，但 UI 看起来像所有骰子都重新播放了动画。
- 根因：领域层 `REROLL_BONUS_DIE` / `BONUS_DIE_REROLLED` 已经携带 `dieIndex`，实际只更新被选中的骰子；问题在 UI 动画触发粒度。
- 旧 UI 只按骰子值变化或组件重新挂载触发滚动/入场动画；重投后可重投状态从可点变为不可点时，外层节点也可能整体切换，导致多颗骰子一起播放动画。

## 修复

- `PendingBonusDiceSettlement` 增加 `lastRerolledDieIndex` 与 `rerollAnimationKey`。
- `handleBonusDieRerolled` 在 reducer 中记录最近一次被重投的骰子索引，并递增动画 key。
- `BonusDieSpotlightContent` 支持 `animateOnMount` 与 `rollAnimationKey`，有显式 key 时只在 key 变化时播放滚动。
- `BonusDieOverlay` 在多骰重投场景只给 `lastRerolledDieIndex` 对应骰子传入动画 key；其它骰子不拿重投动画 key。
- 重投前后外层保持稳定的 reroll button 节点；达到上限后只禁用按钮，不再在 `button` / `div` 之间切换，避免整组 Framer 入场动画重播。

## 验证

- `npx eslint e2e/dicethrone/dicethrone-thunder-strike.e2e.ts src/games/dicethrone/ui/BonusDieSpotlightContent.tsx e2e/src/games/dicethrone/ui/BonusDieSpotlightContent.tsx src/games/dicethrone/ui/BonusDieOverlay.tsx e2e/src/games/dicethrone/ui/BonusDieOverlay.tsx`
  - 结果：通过，0 errors。
- `npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
  - 结果：40 tests passed。
  - 既有 stderr：React mock 下 `whileHover/whileTap` warning、missing_sfx warning；不阻断本轮。
- `npm run typecheck`
  - 结果：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-thunder-strike.e2e.ts "重掷奖励骰会消耗太极并更新结算状态"`
  - 结果：1 passed。
  - E2E 断言：
    - 重投前 3 颗骰子都没有 `rollAnimationKey`。
    - 点击第一颗骰子后，状态为 `lastRerolledDieIndex=0`、`rerollAnimationKey=1`。
    - 页面上三颗骰子的动画 key 为 `['1:0', '', '']`，只有第一颗具备重投动画触发资格。

## 截图观察

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\bonus-reroll-targeted-animation\01-before-reroll.png`
  - 实际看到三颗奖励骰本体，结果为 `2 / 4 / 6`。
  - 提示文案为“点击骰子花费2太极重掷”，说明处于真实可重投特写状态。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\bonus-reroll-targeted-animation\02-after-first-die-reroll-result.png`
  - 实际看到第一颗骰子已经变为 `6`，第二颗仍为 `4`，第三颗仍为 `6`。
  - 左侧第一颗处在重投后的翻转/动态状态；第二、第三颗保持稳定展示，没有整组一起播放重投动画。
  - 提示文案变为“已达到本次重掷上限”，说明真实重投命令已经完成并进入不可再次重投状态。
