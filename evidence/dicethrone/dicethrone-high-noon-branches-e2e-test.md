# DiceThrone：枪手卡牌「High Noon / 賭命輪盤！」三分支端到端证据链

> 目标：补齐“High Noon 三分支”稳定可复查的 **成功路径** 证据链（bullet / dash / bullseye），并满足 E2E 规范中“连续截图链”要求（特写 → 关闭 → 收口后最终态）。

## 真相源与语义约束

- 真相源（卡面裁图）：`D:\gongzuo\webgame\BoardGame\temp\dicethrone\atlas-crops-20260411\gunslinger\slot-29.webp`
- `card-high-noon`（枪手行动卡，运行时显示名：`High Noon / 正午时分！`；卡面别名：`賭命輪盤！`）：**选择 1 位目标玩家**（1v1 自动为唯一对手），掷 1 颗枪手奖励骰，根据骰面分支：
  - `bullet`：造成 **2 点不可防御伤害**
  - `dash`：施加 **1 层击倒**
  - `bullseye`：施加 **1 层赏金**

本轮验证采用测试注入强制骰值：
- `1` → `bullet`
- `4` → `dash`
- `6` → `bullseye`

（映射来源：`src/games/dicethrone/heroes/gunslinger/diceConfig.ts`）

## 运行命令（已执行）

分别单测 3 条用例（保证每条都有独立证据目录）：

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-high-noon（bullet）应造成 2 点不可防御伤害，并提供奖励骰特写证据链"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-high-noon（dash）应施加 1 层击倒，并提供奖励骰特写证据链"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-high-noon（bullseye）应施加 1 层赏金，并提供奖励骰特写证据链"
```

## 运行结果
- Playwright：三条用例均为 `1 passed`（单 worker / 单用例）。

## 证据与肉眼结论

### A) bullet 分支（2 点不可防御伤害）

**截图链：**

1) 奖励骰特写（显示 bullet 骰面）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（bullet）应造成-2-点不可防御伤害，并提供奖励骰特写证据链\gunslinger-high-noon-bullet-overlay.png`

2) 关闭特写（完成收口动作）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（bullet）应造成-2-点不可防御伤害，并提供奖励骰特写证据链\gunslinger-high-noon-bullet-closed.png`

3) 收口后最终态（伤害已生效）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（bullet）应造成-2-点不可防御伤害，并提供奖励骰特写证据链\gunslinger-high-noon-bullet-settled.png`

**结论（我实际看到/断言的事实）：**
- 特写中骰面为 `bullet`，且收口后目标玩家 HP 从 `50` 降为 `48`（2 点不可防御伤害）。
- 该链路为成功路径，不依赖失败 toast 或误导提示。

### B) dash 分支（1 层击倒）

**截图链：**

1) 奖励骰特写（显示 dash 骰面）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（dash）应施加-1-层击倒，并提供奖励骰特写证据链\gunslinger-high-noon-dash-overlay.png`

2) 关闭特写（完成收口动作）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（dash）应施加-1-层击倒，并提供奖励骰特写证据链\gunslinger-high-noon-dash-closed.png`

3) 收口后最终态（状态已生效）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（dash）应施加-1-层击倒，并提供奖励骰特写证据链\gunslinger-high-noon-dash-settled.png`

**结论（我实际看到/断言的事实）：**
- 特写中骰面为 `dash`，且收口后目标玩家 `knockdown=1`。
- 该链路为成功路径，且“特写关闭”是结算完成的必要收口动作（证据链覆盖了收口）。

### C) bullseye 分支（1 层赏金）

**截图链：**

1) 奖励骰特写（显示 bullseye 骰面）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（bullseye）应施加-1-层赏金，并提供奖励骰特写证据链\gunslinger-high-noon-bullseye-overlay.png`

2) 关闭特写（完成收口动作）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（bullseye）应施加-1-层赏金，并提供奖励骰特写证据链\gunslinger-high-noon-bullseye-closed.png`

3) 收口后最终态（token 已生效）
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-high-noon（bullseye）应施加-1-层赏金，并提供奖励骰特写证据链\gunslinger-high-noon-bullseye-settled.png`

**结论（我实际看到/断言的事实）：**
- 特写中骰面为 `bullseye`，且收口后目标玩家 `bounty=1`。
- 该链路为成功路径（不是失败提示）。

## 覆盖声明与未覆盖风险

- 本文覆盖：`card-high-noon` 在 **1v1 场景** 下的三分支结算正确性，以及奖励骰特写的“出现→关闭→收口”闭环。
- 4 人 2v2 模式下“目标玩家（all seating）”的交互 UI 证据：由 `evidence/dicethrone/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md` 覆盖（本文不重复贴图；本次文档回写按**历史证据复用**口径引用该文档，不额外宣称本轮已复跑 4P 用例）。
