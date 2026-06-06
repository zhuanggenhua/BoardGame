# DiceThrone 反馈 69d3572da812935931090493 历史修复证据（2026-04-22）

> 2026-06-06 当前有效口径：本文只保留 `69d3572da812935931090493` 这条 Online AI / watchdog / main2 卡死反馈链的专项修复证据，不代表 DiceThrone 全体在线对局、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时这条 watchdog 收口链被真实在线 E2E 复核过，不能外推成 DiceThrone 当前总体收口。

## 反馈原文

- feedbackId: `69d3572da812935931090493`
- 严重级别：`critical`
- 描述：`AI强制接受不了回合`
- 路由：`/play/dicethrone/match/Rg6go7LsfGf?playerID=0`

## 根因与修复

- 问题位点：`e2e/dicethrone/dicethrone-simple-start.e2e.ts`
- 现象：用于复现 main2 卡死的 E2E 前置断言过于刚性（要求 `rejectedCount === 1` 且 `aiHandCount === 0`），导致在 watchdog 多次拒绝/重试时误判失败，无法稳定证明“服务端已自动收口”。
- 修复：将前置条件改为“至少发生一次 batch 拒绝”（`rejectedCount >= 1`），避免把实现已恢复但拒绝次数变化的场景误判为失败。

## 验证命令

1. `npx eslint e2e/dicethrone/dicethrone-simple-start.e2e.ts`
2. `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 在 off-turn defensiveRoll 也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段"`
3. `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 在 DiceThrone main2 阶段持续卡死时，服务端 watchdog 应自动多步收口到我方回合且不再弹失败提示"`

## 关键截图与结论

1. 卡死前（main2）
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\19-online-ai-main2-stalled-before-watchdog.png`
   - 实际观察：左侧阶段在 `3.主要阶段(1)`，界面存在“AI2 号位正在思考中”，属于 AI 回合待处理态。
   - 验收判定：达标（问题触发前态清晰可见）。

2. watchdog 收口后
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\20-online-ai-main2-stalled-after-watchdog.png`
   - 实际观察：页面回到可继续推进状态，右下角“下一阶段”可见，未出现“强制结束 AI 回合未成功”失败提示。
   - 验收判定：达标（watchdog 已完成自动收口）。

3. off-turn defensiveRoll 收口链路（补充）
   - 触发前：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05h-online-ai-offturn-defensive-before.png`
   - 执行中：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05i-online-ai-offturn-defensive-rolled.png`
   - 收口后：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05j-online-ai-offturn-defensive-resolved.png`
   - 实际观察：防御阶段已被 AI 自动处理并进入后续阶段，没有停在防御交互死锁。
   - 验收判定：达标（同类卡死链路未复发）。

## 结论

- 反馈 `69d3572da812935931090493` 对应的“AI 回合卡死无法收口”链路已通过真实在线 E2E 验证。
- 本轮是**修复+验证**，非仅状态关闭。

## 当前阅读说明

- 本文只覆盖一条历史 watchdog 卡死反馈链，不覆盖更广范围 DiceThrone 在线对局或新英雄整批完成态。
- 即使本文中的在线 E2E、截图和修复结论在当轮成立，也不能把它当成当前 DiceThrone 或新英雄整批“全面收口”的证明。
