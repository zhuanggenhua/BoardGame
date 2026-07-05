# DiceThrone 武僧连段冲拳②回归 E2E 证据

## 验收对象

- 对象：武僧“连段冲拳② / 太极连环拳 II”。
- 场景：进攻方投出可触发“连段冲拳②”的骰面，防御结算后两颗奖励骰分别固定为 4、5，均为太极面。
- 预期：结算为 5 点伤害 + 攻击方获得 4 个太极，不触发净化或闪避选择。

## 执行命令

```powershell
npx eslint e2e/dicethrone/dicethrone.e2e.ts e2e/framework/GameTestContext.ts
node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/dicethrone.e2e.ts --grep "武僧连段冲拳"
```

## 验证结果

- ESLint：0 errors，52 warnings；warnings 均为 `GameTestContext.ts` 既有 `no-explicit-any` 告警。
- 目标 E2E：1 passed。
- 状态断言证明：
  - 防御结算后进入主要阶段（2）。
  - 防御方生命从 50 变为 45，证明实际造成 5 点伤害。
  - 攻击方太极为 4，证明两颗太极奖励骰按 4 气/太极结算。
  - 攻击方净化为 0、闪避为 0，且当前没有残留交互，证明没有错误触发净化/闪避选择。
  - 事件流包含两颗奖励骰：4 太极、5 太极；同时包含来源为 `taiji-combo` 的 5 点伤害事件。

## 截图证据

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone.e2e\regression-武僧连段冲拳②两颗太极奖励骰结算为5伤害加4太极\04-武僧连段冲拳二-两颗太极结算后.jpg`
- 尺寸：1920 x 1080。
- 肉眼核图：
  - 画面为真实 DiceThrone 游戏整屏，不是临时页面或合成图。
  - 左侧回合顺序高亮在“主要阶段（2）”，顶部提示显示已确认投掷结果。
  - 左侧攻击方资源区可见生命 50、CP 2，并显示太极 4/5，和 E2E 状态断言一致。
  - 右侧仍可见防御方骰区和下一阶段按钮，说明流程已经回到可继续操作状态。

## 结论

- 端到端已证明“连段冲拳②”在两颗奖励骰为太极面时，结算结果为 5 点伤害 + 4 太极。
- 本回归没有触发净化或闪避选择，也没有留下未完成交互。
- 中间攻击对象的 `damage` 字段不是稳定伤害真相源；本用例改为以最终生命、太极、事件流和截图作为验收依据。
