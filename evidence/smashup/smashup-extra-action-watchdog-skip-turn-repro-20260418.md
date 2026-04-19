# Smash Up 额外战术卡住后自动跳回合复现（2026-04-18）

## 复现目标
- 复现用户反馈：“AI 在额外战术交互卡住后，会被 watchdog 自动推进，导致跳过 AI 回合”。

## 复现范围
- 传输层 watchdog 恢复链路（`GameTransportServer.runOnlineAiRecoverySequence`）。
- 场景：Smash Up 额外战术交互（`simple-choice`）+ follow-up active-turn。

## 复现用例与命令
- 文件：`src/engine/transport/__tests__/server.test.ts`
- 旧复现用例（已用于确认问题）：  
  1) `online AI watchdog 在额外战术交互卡住时会先 skip 再 ADVANCE_PHASE（可复现“AI 被跳回合”）`  
  2) `online AI watchdog 在额外战术交互中遇到 private overlay stale 时，仍会 fallback 为 skip + ADVANCE_PHASE`
- 复现日志（绝对路径）：  
  `D:\gongzuo\webgame\BoardGame\test-results\repro-smashup-extra-action-watchdog-20260418.log`

## 复现结论
在旧实现里，watchdog 把“解堵交互”和“推进阶段”耦合处理，出现如下错误行为：
1. `SYS_INTERACTION_RESPOND(skip)` 成功后继续执行 `ADVANCE_PHASE`；
2. AI 当前回合被直接推进给下一位玩家（`turnNumber` 增加，`activePlayerId` 切走）；
3. 即使 AI 决策层报告 `stale-private-overlay`（private-required），仍会 fallback 到 `ADVANCE_PHASE`。

这与“有时自动跳过一回合”的反馈一致。
