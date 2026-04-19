# DiceThrone 教程掷骰动画不阻塞后续操作 E2E 证据

## 用例

- 文件：`e2e/dicethrone/dicethrone-tutorial-simple.e2e.ts`
- 用例：`Tutorial roll visual should not block next required action`
- 命令：`npm run test:e2e:ci:file -- dicethrone-tutorial-simple.e2e.ts "Tutorial roll visual should not block next required action"`

## 根因

- 真实问题不在特写层命中失败，而在教程推进到 `play-six` 时，掷骰视觉动画 `isRolling` 仍未结束。
- `DiceTray` 原先在 `handleDieClick` 开头直接用 `if (isRolling) return;` 拦掉点击，导致教程已经要求玩家选骰，但逻辑仍把点击视为无效。
- 本次修复改为只在“非交互态”时阻止滚动中的点击：`if (isRolling && !isInteractionMode) return;`。

## 结论

- 教程推进到掷骰阶段后，点击 `掷骰`，再打出 `Play Six`，此时即使掷骰视觉动画还在播放，点击骰子也能正常被教程交互接收。
- E2E 在点击 `die-button-0` 后成功推进到教程步骤 `dice-confirm`，说明“骰子特写/掷骰视觉挡住下一步操作”的问题已修复。
- 这次问题的主根因是 `DiceTray` 的交互门控过严；`SpotlightContainer` 的点击穿透修复属于并行加固，不是这条教程卡死的唯一根因。

## 截图

![教程已推进到可确认步骤](../../test-results/evidence-screenshots/dicethrone/dicethrone-tutorial-simple.e2e/tutorial-roll-visual-should-not-block-next-required-action/tutorial-roll-visual-non-blocking.png)

截图绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-tutorial-simple.e2e\tutorial-roll-visual-should-not-block-next-required-action\tutorial-roll-visual-non-blocking.png`

## 截图分析

- 该截图拍摄于 E2E 成功断言教程步骤等于 `dice-confirm` 之后，因此它对应的是“已完成选骰，可进入下一步确认”的稳定状态。
- 截图文件由本用例固定输出到 `test-results/evidence-screenshots/dicethrone/`，可作为后续回归验证的对照基线。
- 结合用例中的真实交互链路，可以确认教程并没有在 `Play Six` 之后卡死在“必须选骰但点了没反应”的状态。

## 验证结果

- `npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
  - 结果：`16 passed`
- `npm run test:e2e:ci:file -- dicethrone-tutorial-simple.e2e.ts "Tutorial roll visual should not block next required action"`
  - 结果：`1 passed`
