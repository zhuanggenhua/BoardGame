# 深不可测的目的 / 适者生存修复证据

## 范围

- `elder_thing_unfathomable_goals`：对手有疯狂卡时，被迫消灭自己的随从，但来源仍应视为施放者的行动卡，必须尊重“野生保护区”。
- `dino_survival_of_the_fittest` / POD：该行动不应要求玩家选择一个目标基地；结算应扫描所有基地，并在最低力量平局时让玩家选择。

## 验证

- `npm run test -- src/games/smashup/__tests__/wildlifePreserveProtection.test.ts`
  - 15 tests passed。
  - 覆盖“深不可测的目的”单随从自动消灭分支：野生保护区保护下不生成 `MINION_DESTROYED`。
  - 覆盖多随从选择分支：受野生保护区保护的随从不会出现在可选目标中，未保护随从仍可被消灭。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts --config vitest.config.audit.ts --configLoader native`
  - 8 tests passed。
  - 覆盖无需 `targetBaseIndex` 仍能全局扫描所有基地，并且不会忽略多个己方随从。
- `npm run test:e2e:ci:file -- e2e/smashup-gameplay.e2e.ts "适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择"`
  - 1 test passed。

## 截图核对

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-gameplay.e2e\适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择\sotf-after-card-click-selected-global-action.png`
  - 我实际看到：`适者生存` 手牌被绿色边框选中，三个基地均未进入“必须点某个基地”的目标选择态。
  - 验收判断：达到“不再误导成只能选择一个基地”的要求。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-gameplay.e2e\适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择\sotf-after-global-action-awaiting-tiebreak.png`
  - 我实际看到：第二次点击卡牌后，手牌中的 `适者生存` 已进入弃牌区，界面出现“选择要消灭的最低力量随从”提示。
  - 验收判断：达到“无目标行动也能结算并进入后续选择”的要求。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-gameplay.e2e\适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择\sotf-tiebreak-candidates-visible.png`
  - 我实际看到：第 1 个基地的两个最低力量候选随从均有绿色可选边框；第 2 个基地低力量随从已灰化/处理；第 3 个基地单随从仍在场。
  - 验收判断：达到“全局扫描所有基地，平局时继续提供选择”的要求。

