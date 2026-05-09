# DiceThrone 69fcbeea 奖励骰特写回归

## 结论

这条是线上真实反馈，原始问题是 Pyromancer 技能内奖励骰结算后前台看起来卡死。当前已用 Pyromancer `pyro-blast II` 的双奖励骰 displayOnly 链路补齐真实 UI 证据，证明奖励骰特写可见、可关闭，并且关闭后权威 `pendingBonusDiceSettlement` 清空、流程回到可继续推进的主阶段(2)。

## 我实际看到的线上截图

- [用户原始反馈图](../../temp/feedback-closeout/decoded/feedback-69fcbeea.jpg)
- 这张图里能直接看到 `Pyromancer` 的主阶段(2)和中间的“投掷结果”奖励骰结算区，右下角有 `不愧是我！`，属于技能/卡牌链路内的奖励骰展示问题。

## Pyromancer 双奖励骰证据链

- [真实页面原位特写](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/pyromancer-pyro-blast-II-should-show-and-close-a-two-dice-display-only-bonus-settlement/11-pyromancer-pyro-blast-2-display-overlay-page.png)
- [奖励骰局部细节](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/pyromancer-pyro-blast-II-should-show-and-close-a-two-dice-display-only-bonus-settlement/11-pyromancer-pyro-blast-2-display-overlay-detail.png)
- [关闭后页面](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/pyromancer-pyro-blast-II-should-show-and-close-a-two-dice-display-only-bonus-settlement/11-pyromancer-pyro-blast-2-display-closed.png)
- [收口后可继续](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/pyromancer-pyro-blast-II-should-show-and-close-a-two-dice-display-only-bonus-settlement/11-pyromancer-pyro-blast-2-display-settled.png)

### 我实际看到什么

- `overlay-page` 是真实页面原位截图，不是 DOM 克隆；画面中央可见“投掷结果”和两颗 Pyromancer 奖励骰本体。
- `overlay-detail` 是真实 locator 截图，可清楚看到双奖励骰骰面本体，满足“对象本体必须可见”的证据要求。
- `closed` 图里中央奖励骰特写已消失，页面仍停在主阶段(2)，不是白屏或新遮挡。
- `settled` 图继续保持主阶段(2)可操作状态；E2E 同时断言 `pendingBonusDiceSettlement === null` 且没有命令拒绝。

## 通用奖励骰链路补充截图

- [奖励骰特写](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-bonus-die-overlay.png)
- [特写收口后](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-bonus-die-closed.png)
- [收口后继续推进](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-settled.png)
- Samurai 链路用于证明同一奖励骰特写关闭/收口修复在另一条 displayOnly 分支也成立，不作为 `69fcbeea` 的主证据。

## 验证

- `npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "pyromancer pyro blast II should show and close a two-dice display-only bonus settlement"`

## 备注

本轮新增的 Pyromancer E2E 使用真实英雄能力 `PYRO_BLAST_2`、真实 Pyromancer 骰面触发条件和真实 `SKIP_BONUS_DICE_REROLL` 收口，不靠隐藏遮罩或改 z-index 摆拍。
