# DiceThrone 手牌费用与反击伤害数字 E2E 证据

## 范围

- 验收 DiceThrone 手牌区卡牌费用显示。
- 验收 DiceThrone 武士反击链路中的双段伤害数字：先显示己方来伤，再显示对方反伤。
- 验收双段伤害在命中点会同步放开视觉 HP：己方先掉到 `45`，对手随后掉到 `49`。
- 验收双段伤害数字继续沿用红色爆裂章 + 跳字骨架，而不是整块替代原动画。
- 本次不修改卡牌打出、扣费、售卖或阶段规则。

## 参考

- 参考图：`D:\gongzuo\webgame\gameasset\ui参考\dicethrone ui参考.png`
- 费用参考点：手牌费用使用独立 token，轮廓是偏右指向的三角费用牌，不是六边形；青绿色底、白色数字，并贴近卡牌左上区域。
- 伤害参考点：伤害数字保留原来的飞行动画 / 跳字骨架；数字本体使用红色爆裂章承载，大小一致，位置贴近受伤方血条区域并肉眼可读。

## 验证命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-hand-cost-badge.e2e.ts "武士反击链路应先在己方显示来伤，再在对方显示反伤数字"
```

结果：通过，1 passed。

补充：费用牌截图 `01-hand-cost-badges.png` 来自同文件中的费用用例，用户已在本轮明确确认“费用没问题”。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hand-cost-badge.e2e\手牌费用-token-应显示统一三角费用牌且伤害数字明显停留\01-hand-cost-badges.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hand-cost-badge.e2e\武士反击链路应先在己方显示来伤，再在对方显示反伤数字\02-retribution-incoming-damage.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hand-cost-badge.e2e\武士反击链路应先在己方显示来伤，再在对方显示反伤数字\03-retribution-reflect-damage.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hand-cost-badge.e2e\武士反击链路应先在己方显示来伤，再在对方显示反伤数字\04-retribution-final-hp.png`

## 肉眼观察

- `01-hand-cost-badges.png`：手牌区三张卡左上方都能直接看到费用 token 本体，分别显示 `0`、`1`、`3`；`0`、`1` 费为青绿色，`3` 费为灰色不可支付态。
- `01-hand-cost-badges.png`：费用 token 是和卡牌上边缘保持正向对齐的短三角费用牌，贴在卡牌左上角；不再是六边形，也没有歪斜。
- `02-retribution-incoming-damage.png`：左下己方生命条上方直接能看到红色爆裂章里的 `-5`，说明来伤数字没有再被武士反击特写吃掉；爆裂章仍带跳字动势，不是纯静态替代块。
- `02-retribution-incoming-damage.png`：画面中央仍能看到武士反击的单骰特写和说明文案，证明“来伤浮字可见”是在真实反击链路里拿到的，不是关闭特写后的摆拍图。
- `02-retribution-incoming-damage.png`：左下生命条数值已经同步显示 `45`，说明第一段伤害命中时视觉 HP 没再被整段 3 秒跳字卡住。
- `03-retribution-reflect-damage.png`：顶部对手头像条附近直接能看到红色爆裂章里的 `-1`，说明反伤数字确实出现在受伤的对手一侧，而不是只在己方出现。
- `03-retribution-reflect-damage.png`：顶部 `-1` 与底部 `-5` 使用同一套红色爆裂章样式和相近字号规则，没有再出现“己方巨大、对方缺失”的不一致。
- `04-retribution-final-hp.png`：双段伤害跳字完全退场后，左下生命条稳定停在 `45`，顶部对手头像条直接显示 `49`；这证明第二段伤害结算后视觉 HP 已正确释放，没有出现“日志对了但头上不掉血”的残留问题。

## 结论

达到本轮验收标准：DiceThrone 费用牌保持通过；武士反击链路中的来伤与反伤数字都已在真实端到端场景里可见，并保留了原有飞行动画 / 跳字骨架；双段伤害对应的视觉 HP 也已分别在命中后更新到 `45` / `49`。
