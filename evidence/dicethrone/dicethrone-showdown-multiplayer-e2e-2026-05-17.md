# DiceThrone Showdown 双页联机特写验证（2026-05-17）

## 范围

- 游戏：`dicethrone`
- 英雄：`Gunslinger vs Monk`
- 目标：
  1. 确认 `Showdown` 中文录入名已纠正为 `枪战决斗`
  2. 确认联机 `host / guest` 两边都会进入 compare-roll 特写
  3. 确认特写收口后链路仍可继续推进

## 验证命令

```powershell
npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "showdown uses compare-roll-choice and confirms into bonus damage"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-showdown-multiplayer.e2e.ts "枪手 Showdown 应在联机双方页面同时展示枪战决斗特写并自动收口"
```

结果：

- `cross-hero.test.ts` 通过
- `dicethrone-showdown-multiplayer.e2e.ts` 指定用例通过

## 关键截图

### 1. guest 侧真实看到枪战决斗特写本体

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-showdown-multiplayer.e2e\枪手-Showdown-应在联机双方页面同时展示枪战决斗特写并自动收口\showdown-guest-open.png`
- 我实际看到：
  1. 截图中央是 `枪战决斗` 特写本体，不是普通日志，也不是底部卡区。
  2. 左右两边都能看到参赛方标签与骰子展示位，结果文案显示在中央下方。
  3. 本次联机 run 命中了未赢分支，文案为 `未赢得比骰，维持基础伤害。`
- 验收判定：达标，已直接证明至少一侧联机页面真实进入了 Showdown compare-roll 特写。

### 2. 双页联机关闭特写后都回到可继续推进的棋盘

- host 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-showdown-multiplayer.e2e\枪手-Showdown-应在联机双方页面同时展示枪战决斗特写并自动收口\showdown-host-closed.png`
- guest 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-showdown-multiplayer.e2e\枪手-Showdown-应在联机双方页面同时展示枪战决斗特写并自动收口\showdown-guest-closed.png`
- 我实际看到：
  1. 两边截图里 compare-roll 遮罩都已经关闭，没有残留浮层。
  2. 双方都进入了 `掷骰防御阶段` 的正常棋盘视图，说明特写收口后仍可继续推进。
  3. 这次联机 run 的权威状态断言是：特写关闭后 `pendingAttack.bonusDamage === 0`，随后再次 `ADVANCE_PHASE` 成功进入 `defensiveRoll`。
- 验收判定：达标，已证明联机双页在特写收口后不会卡死在 overlay 内。

## 双边可见性的直接断言

虽然 owner 侧 `showdown-host-open.png` 因自动确认窗口过短，没有形成可作为主证据的完整静态特写图，但本轮通过用例已经同时断言：

1. `hostPage.getByTestId('compare-roll-overlay')` 可见
2. `guestPage.getByTestId('compare-roll-overlay')` 可见
3. 两边的 `compare-roll-participant-0/1` 都可见
4. 两边的 `compare-roll-result` 文案完全一致

因此，“两边都进入了同一份 compare-roll 特写”这条合同由自动化断言直接成立；视觉截图里以 guest 侧 open 图作为特写本体样本，以 host/guest 两张 closed 图作为收口样本。

## 结论

- 名字问题属实：`Showdown` 的中文录入以前写成了 `摊到牌面`，现在已统一纠正为真相源里的 `枪战决斗`。
- 特写问题当前不再是“只有一边能看到”。双页联机 E2E 已证明，`Showdown` 的 compare-roll 特写会在 `host / guest` 两边同时出现。
- 在线链路里，本轮实际收口语义是：compare-roll 自动确认先把结果写回权威状态，再由后续 `ADVANCE_PHASE` 进入 `defensiveRoll`。这一点已由通过的联机用例锁住。
