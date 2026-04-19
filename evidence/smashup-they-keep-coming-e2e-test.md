# Smash Up《它们为你而来》E2E 证据

## 目标

验证 `zombie_they_keep_coming` 在浏览器中的真实行为：

- 从弃牌堆选择随从
- 直接部署到基地
- 不先回手
- 不返还正常随从位

## 执行时间

- 2026-03-21

## 执行命令

```powershell
$env:PW_PORT='5173'
node scripts/infra/run-e2e-command.mjs dev e2e/smashup-zombie-lord.e2e.ts --grep "zombie_they_keep_coming: 应从弃牌堆直接额外打出，不回手也不返还随从位"
```

## 截图路径

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\01-discard-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\02-card-selected.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\03-after-deploy.png`

## 截图

### 1. 打出行动卡后，弃牌堆面板打开

![它们为你而来-弃牌堆面板](../test-results/evidence-screenshots/smashup-they-keep-coming/01-discard-panel.png)

### 2. 选中弃牌堆随从后，基地进入可部署状态

![它们为你而来-选中弃牌堆随从](../test-results/evidence-screenshots/smashup-they-keep-coming/02-card-selected.png)

### 3. 选择基地后，随从直接落场

![它们为你而来-随从直接落场](../test-results/evidence-screenshots/smashup-they-keep-coming/03-after-deploy.png)

## 截图分析

- 第 1 张图显示交互来源是弃牌堆面板，不是把随从先放回手牌。
- 第 2 张图底部出现 `Click a base to deploy`，说明选中后下一步就是“直接选基地部署”，不是等待玩家再从手牌打一遍。
- 第 3 张图中 `Walker` 已经在目标基地落场，右下角弃牌堆剩余数量减少，说明该随从已离开弃牌堆。
- 第 3 张图右侧随从额度提示仍然是 `0`，对应“正常随从位没有被返还”。

## 状态断言

本次 E2E 还额外断言了：

- `discard-zombie-walker` 不在手牌中。
- `discard-zombie-walker` 已从弃牌堆移除。
- `discard-zombie-walker` 已在目标基地中。
- `player0.minionLimit === 1`
- `player0.minionsPlayed === 1`

## 结论

《它们为你而来》当前已符合预期：会把弃牌堆中的随从直接作为额外随从打到基地上，不会先进手牌，也不会返还正常随从位。
