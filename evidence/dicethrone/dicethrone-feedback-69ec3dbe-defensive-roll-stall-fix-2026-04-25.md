# DiceThrone 反馈修复证据：69ec3dbe9087da2a55c912a4（AI 卡在防御阶段）

> 2026-06-06 当前有效口径：本文只对应反馈 `69ec3dbe9087da2a55c912a4` 这一条“AI 卡在防御阶段”的历史修复证据，不是当前 DiceThrone 所有 defensiveRoll 卡死、所有 AI 防御阶段行为都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它理解成单条反馈修复记录。

- 反馈 ID：`69ec3dbe9087da2a55c912a4`
- 游戏：`dicethrone`
- 严重级别：`critical`
- 线上反馈原文：`ai卡在防御阶段`

## 根因定位

- 线上快照显示卡死时满足：
  - `phase=defensiveRoll`
  - `rollCount=1 / rollLimit=1 / rollConfirmed=false`
  - `pendingAttack.defenseAbilityId=fearless-riposte`
  - action log 连续出现 `SELECT_ABILITY`，并在 `shadow-defense-2` 与 `fearless-riposte` 间反复切换。
- 对应修复点：`buildPhaseActions` 在 `defensiveRoll` 下，只要已经存在 `pendingAttack.defenseAbilityId`，AI 不再生成 `select-ability`，避免防御技能来回切换导致无法收口。

## 代码改动

- `src/games/dicethrone/ai.ts`
- `e2e/src/games/dicethrone/ai.ts`
- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- `e2e/src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`

## 验证记录

1. Transport 定向回归
   - 命令：`npm run test -- src/engine/transport/__tests__/server.test.ts -t "online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死"`
   - 结果：通过（目标链路所在文件通过，输出 66/66）。

2. 防退化单测（本轮）
   - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism -t "防御阶段掷骰后若已选防御技能，AI 不应再暴露 select-ability，避免循环切换|本地 AI 在 defensiveRoll 应能连续自动执行到离开防御阶段"`
   - 结果：通过（2 passed，77 skipped）。
   - 关键断言：`confirm-roll` 存在，`select-ability` 不再出现，且本地 AI 可离开 `defensiveRoll`。

3. E2E 实链路
   - 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 在 off-turn defensiveRoll 也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段"`
   - 结果：通过（1 passed）。

## 关键截图（绝对路径）

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05h-online-ai-offturn-defensive-before.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05i-online-ai-offturn-defensive-rolled.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05j-online-ai-offturn-defensive-resolved.png`

## 我实际看到的现象

- 截图序列中游戏界面保持可交互状态，未出现“卡死弹窗/流程阻塞遮罩”。
- 结合新增单测与快照回放验证，防御技能选定后 AI 的合法动作已收敛到 `confirm-roll`，不再重复 `SELECT_ABILITY`。
- 对应本反馈的“卡在防御阶段”已可复查为修复。

---

**当前阅读说明**：本文只能证明“已选防御技能后 AI 仍反复 select-ability”这条专项问题曾被修复，不能外推为当前所有 defensiveRoll 卡死、所有防御技能链或 DiceThrone 当前整体审计都已收口。
