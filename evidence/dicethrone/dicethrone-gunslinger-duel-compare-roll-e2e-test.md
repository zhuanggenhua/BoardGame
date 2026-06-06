# DiceThrone 枪手 Duel E2E 证据（2026-04-23）

> 2026-06-05 当前有效口径：本文只保留枪手 `Duel` 早期“结束防御后进入对掷”单链路 `L3` 历史证据，不代表枪手对象级当前完成态。当前若要判断 `Duel` 的现行口径与后续回归范围，应优先以 `evidence/dicethrone/dicethrone-gunslinger-duel-regression-e2e-2026-05-17.md`、`evidence/dicethrone/dicethrone-gunslinger-audit-2026-04-11.md` 与 `src/games/dicethrone/rule/枪手录入核对.md` 为准。

## 测试目标
- 验证 `duel` 在防御阶段是“只能直接结束防御”，而不是普通手动掷骰流程。
- 验证直接结束防御后会进入 `compare-roll-choice` 双骰特写，并可正常收口。

## 执行命令
```bash
npm run test:e2e:ci:file -- e2e/dicethrone-defense-selection.e2e.ts "枪手 Duel 防御阶段应禁用手动投掷并可直接结束防御进入对掷"
npm run test:e2e:ci:file -- e2e/dicethrone-defense-selection.e2e.ts "枪手 Duel 应展示双方对掷 UI，并在选择抵挡一半后结算"
```

## 结果
- 通过：`1 passed` + `1 passed`

## 关键截图与肉眼验收

1) 直接结束防御前（达标）  
路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-defense-selection.e2e\枪手-Duel-防御阶段应禁用手动投掷并可直接结束防御进入对掷\gunslinger-duel-direct-defense-before-advance.png`  
- 右下角“投掷”按钮为禁用态。  
- “结束防御”按钮可见，流程引导点是结束防御而不是手动掷防御骰。  
- 结论：达到“不能手动掷骰”的验收标准。

2) 点击结束防御后进入对掷（达标）  
路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-defense-selection.e2e\枪手-Duel-防御阶段应禁用手动投掷并可直接结束防御进入对掷\gunslinger-duel-direct-defense-after-advance.png`  
- 出现对掷浮层，能看到双方骰子本体与对掷结果区。  
- 没有进入普通防御掷骰确认链路。  
- 结论：达到“结束防御直接进入对掷”的验收标准。

3) 对掷特写出现（达标）  
路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-defense-selection.e2e\枪手-Duel-应展示双方对掷-UI，并在选择抵挡一半后结算\gunslinger-duel-compare-roll-choice.png`  
- 中央浮层显示双方参与者与骰面，属于 `compare-roll-choice` 形态。  
- 结论：达到“对掷特写已触发”的验收标准。

4) 执行关键操作后状态变化（达标）  
路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-defense-selection.e2e\枪手-Duel-应展示双方对掷-UI，并在选择抵挡一半后结算\gunslinger-duel-compare-roll-after-click.png`  
- 点击“抵挡 1/2 进攻伤害”后浮层状态变化，链路进入结算。  
- 结论：达到“关键操作后状态有变化”的验收标准。

5) 收口后可继续推进（达标）  
路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-defense-selection.e2e\枪手-Duel-应展示双方对掷-UI，并在选择抵挡一半后结算\gunslinger-duel-compare-roll-settled.png`  
- 对掷浮层已关闭，回到主战场 UI。  
- 阶段进入 `主要阶段(2)`，流程可继续推进。  
- 结论：达到“交互收口完成”的验收标准。
