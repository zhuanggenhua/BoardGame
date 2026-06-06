# 树精 vs 月精灵伤害动效 E2E 证据

> 2026-06-05 当前有效口径：本文只保留树精 `shattering-fist-5` 对月精灵 `elusive-step` 这条双边伤害动效链的对象级/单链路证据，不代表树精整英雄、月精灵整英雄或伤害表现系统全量当前完成态。当前若要判断树精对象级残余、Treant/Ninja 整批口径或更广视觉链路，应以 `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`、`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与对应专项 evidence 为准。

日期：2026-05-17

范围：
- DiceThrone 树精用 `shattering-fist-5` 攻击月精灵。
- 月精灵结算 `elusive-step`。
- 验证真实棋盘链路里两段伤害浮字都出现，且最终血量稳定。

命令：

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-moon-elf-damage-visual.e2e.ts "破碎之拳打到打不到我时应同时看到两段伤害动画和两边掉血"
```

结果：通过，1 个用例。

## 截图观察

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-moon-elf-damage-visual.e2e\破碎之拳打到打不到我时应同时看到两段伤害动画和两边掉血\01-self-damage-visible.png`

   我实际看到左下角树精生命面板出现红色 `-1` 伤害浮字，树精 HP 已变为 `49`。这达到“自己受到反伤且有可见动效”的验收标准。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-moon-elf-damage-visual.e2e\破碎之拳打到打不到我时应同时看到两段伤害动画和两边掉血\02-opponent-damage-visible.png`

   我实际看到顶部月精灵头像栏出现红色 `-3` 伤害浮字，同时树精的 `-1` 浮字仍然可见。这证明同一条真实棋盘流程里两段伤害动效能同时被玩家看到。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-moon-elf-damage-visual.e2e\破碎之拳打到打不到我时应同时看到两段伤害动画和两边掉血\03-final-hp-stable.png`

   我实际看到最终稳定血量为树精 `49`、月精灵 `47`，且伤害浮字已经收口消失。这达到最终状态验收标准。

## 实现说明

这个 E2E 的命令 helper 必须在 payload 里传 `__tutorialPlayerId`，因为 `LocalGameProvider` 从 payload 解析实际执行玩家，不从测试命令外层的 `command.playerId` 取值。如果没有这个覆盖，防御阶段的 `ADVANCE_PHASE` 会被当成进攻方执行，并被拒绝为 `player_mismatch`。
