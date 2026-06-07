# DiceThrone Showdown 对掷特写回归验证（2026-05-17）

## 范围

- 游戏：`dicethrone`
- 英雄：`Gunslinger vs Monk`
- 问题：`Showdown / 枪战决斗` 只有日志，没有 compare-roll 特写

## 验证命令

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "showdown uses compare-roll-choice and confirms into bonus damage"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-defense-selection.e2e.ts "枪手 Showdown 应展示双方对掷 UI，并在自动确认后写入加伤"
```

结果：

- `cross-hero.test.ts` 通过
- `dicethrone-defense-selection.e2e.ts` 指定用例通过

## 关键截图

### 1. 对掷特写出现

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-defense-selection.e2e\枪手-Showdown-应展示双方对掷-UI，并在自动确认后写入加伤\gunslinger-showdown-compare-roll-open.png`
- 我实际看到：
  1. 画面中央出现 `枪战决斗` 对掷 overlay，不再只是底部/侧边日志文字。
  2. 特写里能直接看到双方骰子本体，满足“对象本体必须可见”的证据要求。
  3. 结果文案显示 `本次攻击伤害 +2`，说明这次对掷赢了，且加伤信息在 overlay 内明确可见。
- 验收判定：达标，已证明 Showdown 真实链路会弹出 compare-roll 特写。

### 2. 自动确认收口后状态

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-defense-selection.e2e\枪手-Showdown-应展示双方对掷-UI，并在自动确认后写入加伤\gunslinger-showdown-compare-roll-closed.png`
- 我实际看到：
  1. 对掷 overlay 已关闭，棋盘回到正常战斗视图，没有残留遮罩。
  2. E2E 同步断言 `pendingAttack.bonusDamage === 2`，说明加伤不是只显示在 UI 上，而是已经落进权威状态。
  3. 阶段推进到 `defensiveRoll`，符合当前引擎在 pre-defense 比骰收口后继续进入防御阶段的真实行为。
- 验收判定：达标，已证明特写关闭后链路继续推进，且加伤成功写回。

## 结论

- 根因不是日志组件抢走了特写，而是 `gunslinger-showdown-bonus` 原先直接后台掷骰并返回 `BONUS_DAMAGE_ADDED`，没有产出 `compare-roll-choice` 前台交互。
- 本轮修复后，`Showdown` 会先发 compare-roll 交互，再通过自动确认把加伤写回 `pendingAttack.bonusDamage`。
