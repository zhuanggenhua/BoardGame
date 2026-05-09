# SmashUp 69fd9c33 结束回合回归

## 结论

这条是线上真实反馈，根因是 `ADVANCE_PHASE` 在当前回合已用完随从和战术额度时仍应允许结束回合。

## 我实际看到的线上截图

- [反馈截图](../../temp/feedback-closeout/decoded/feedback-69fd9c33.jpg)
- 画面里已经是 `playCards` 阶段，左侧提示可结束回合，右上角弹了“命令执行异常，请稍后重试”。
- 右侧和底部都还能看到本回合实际打出的《深潜者》《本地人》链路，不是空场误判。

## 本地复核

- 生产快照里：
  - `phase = playCards`
  - `currentPlayerIndex = 0`
  - `player 0` 的 `minionsPlayed = 1 / 1`
  - `player 0` 的 `actionsPlayed = 1 / 1`
  - `sys.interaction.current = undefined`
- 这说明不是还有未完成交互，而是结束回合命令链本身在这个边界态失败。

## 修复点

- 补了 `base_the_factory` / `base_mushroom_kingdom` 相关 effect contract 读取口径。
- 新增回归用例，覆盖“用完随从和战术额度后仍可结束回合”的真实状态。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts --configLoader native`

## 备注

这条已经有足够的本地验证和线上证据，可以进入状态回写。
