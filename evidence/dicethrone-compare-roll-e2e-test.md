# DiceThrone compare-roll 交互 E2E 证据（2026-04-05）

## 范围

- 游戏：`dicethrone`
- 目标：验证新交互类型 `compare-roll-choice` 已经端到端接通：
  - 领域事件 / 系统映射
  - 前端 overlay 渲染
  - 交互命令响应
  - 结果落状态

## 验证命令

```powershell
npx vitest run src/engine/systems/__tests__/InteractionSystem.test.ts -t "compare-roll-choice"
npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "duel|showdown uses compare-roll-choice"
npm run typecheck
npm run test:e2e:ci:file -- e2e/dicethrone-defense-selection.e2e.ts "枪手 Duel 应展示双方对掷 UI，并在选择抵挡一半后结算"
cmd /c npm run test:e2e:ci:file -- e2e/dicethrone-defense-selection.e2e.ts "枪手 Showdown 应展示双方对掷 UI，并在自动确认后继续结算链路"
```

结果：

- `InteractionSystem.test.ts` 通过
- `cross-hero.test.ts` 相关用例通过
- `typecheck` 通过
- 2 条 compare-roll E2E 通过

## 关键截图

### 1. Duel 对掷分支选择

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-defense-selection.e2e\枪手-Duel-应展示双方对掷-UI，并在选择抵挡一半后结算\gunslinger-duel-compare-roll-choice.png`

肉眼观察：

1. 画面中心不是普通 `ChoiceModal`，而是独立的对掷 overlay；标题直接显示“对决”，说明这条交互已脱离普通按钮选择框。
2. 屏幕中央能同时看到两颗大骰和双方标签位，证明“我方 / 攻击方对掷”已经被显式展示，而不是只剩结果数值。
3. 这张图更像过程帧，未完整捕获底部结果文案和分支按钮；对应文本与按钮存在性由同一条 E2E 断言补充验证。

状态断言：

- 点击“抵挡 1/2 进攻伤害”后，`sys.interaction.current === null`
- 防御方获得 `reductionPercent = 50` 的 `damageShield`

### 2. Showdown 自动确认

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-defense-selection.e2e\枪手-Showdown-应展示双方对掷-UI，并在自动确认后继续结算链路\gunslinger-showdown-compare-roll-auto-confirm.png`

肉眼观察：

1. 标题直接显示“摊到牌面”，中央同屏展示双方骰子，说明这条 pre-defense 比较也已进入统一 compare-roll 承载层。
2. 棋盘仍保持在攻击流程上下文里，没有被降级成脱离战局的普通提示框；比较结果是覆盖在真实战局上的。
3. 这张图同样偏过程帧，主要证明“双骰比较 UI 已出现”；自动确认提示与结果文案由 E2E 文本断言补足。

状态断言：

- 自动确认后，`sys.interaction.current === null`
- `pendingAttack.bonusDamage === 2`
- 阶段保持在 `offensiveRoll`，符合 `Showdown` 仍处于 pre-defense 处理链的语义

## 备注

- `Showdown` 这条 E2E 在 PowerShell 直接执行时出现过一次 shell 自身崩溃；改为 `cmd /c npm run ...` 后稳定通过。
- 该 shell 崩溃不属于业务代码失败，因此不影响本轮 compare-roll 实现结论。
