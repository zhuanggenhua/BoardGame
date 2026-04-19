# 冲突解决汇报：origin-main-2026-04-14

## 1. 背景
- base: `d8e3eb378f36a668c21a39a7d4389b6aa1fdcd27`
- head: `10eb074d982a98b9812783ce4a8025765bed56ce` (`origin/main`)
- 触发命令: `git merge origin/main`
- 发生时间: 2026-04-14

## 2. 冲突文件
- `src/games/smashup/abilities/titans.ts`

## 3. 解决策略
### `src/games/smashup/abilities/titans.ts`
- 策略：块级合并，保留双方有效内容。
- 冲突块裁决：
  - 块 A（`buildTheBrideStartBranchOptions`）：保留本地分支的 `createSkipOption('跳过（本回合不让 The Bride 进场）')`，同时保留本地中文修正 `移除 +1 指示物`，不回退成 `移除 +1 标记`。
  - 块 B（`titan_frankenstein_the_bride_talent_extra_action` 交互标题）：保留 `The Bride：选择要移除的指示物组合`，不回退成 `标记组合`。
- 合并要点：
  - 本地分支新增的是功能语义：为 `The Bride` 首次进场分支补 `skip` 选项，避免强制进场。
  - 远端分支新增的是整体大规模 Smash Up 合流与文案整理；本冲突块里远端的 `标记` 文案并不比本地 `指示物` 更权威。
- 原因：
  - 仓库现有 Smash Up 语义和测试口径以 `+1 指示物` 为主；直接整段接受远端会丢掉本地新增的 skip 功能。
  - 直接整段接受本地也会绕过这次 origin/main 的其余大规模合流，因此只对冲突块做最小裁决。

## 4. 风险与验证
- 风险点：
  - `The Bride` 相关交互文案与 smoke 测试口径是否仍一致。
  - 合并后是否出现“文本修正保住了，但 skip 选项被静默吃掉”的回归。
- 验证命令：
  - `npm run i18n:check`
  - `npm run merge:audit -- HEAD`
  - `npm run merge:audit:strict -- HEAD`
- 验证结果：
  - `npm run i18n:check`：通过，仅有仓库既有 42 条 warning。
  - `npm run merge:audit -- HEAD`：通过；`完全等于父1/父2 = 0`，`混合结果 = 97`。
  - `npm run merge:audit:strict -- HEAD`：通过；无单边整份覆盖风险。

## 5. 回归与行为变化登记
- 原 PR / 本地目标问题：
  - DiceThrone 在线 AI 响应窗口/强制结束链路修复。
  - Summoner Wars 移动端 HUD/手牌与证据补齐。
- 本次额外发现的真实回归：
  - 无新增真实回归；冲突仅发生在 Smash Up `The Bride` 文案与 skip 选项同一函数块。
- 仅业务口径 / 规则变化：
  - `The Bride` 相关中文文案继续统一为“指示物”口径；无需新增规则改动，只保持实现与测试文案一致。

## 6. 结果
- merge commit: `cf916180038cdf4de9ddd718e6686f794e38db0c`
- push 目标：`origin/main`
