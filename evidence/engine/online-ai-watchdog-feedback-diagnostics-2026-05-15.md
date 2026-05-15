# 在线 AI 自动反馈诊断链复核（2026-05-15）

## 范围

- 生产真源：`boardgame.feedbacks`
- 对象：当前仍 open 的 `online-ai-watchdog` 自动反馈
- 目标：判断是反馈证据不足，还是 watchdog 本身确实有 bug

## 结论

- 这条 open 反馈不是“没证据”，而是一个真实的 watchdog 根因：Splendor 在未开局状态下仍被 watchdog 代发合法动作，最终撞到 `RESERVE_OPEN_CARD:gameNotStarted`。
- 反馈内容已经足够定位到命令类型和领域拒绝原因，不需要再重构自动反馈 payload 本身。
- 我修的是运行时门禁：未开局时不再触发这条 active-turn legal-action watchdog，同时让 Splendor AI legal actions 自身也拒绝未开局状态。

## 生产证据

- open 记录：
  - `_id = 6a05e66129cd213e03bfd82f`
  - `gameId = splendor`
  - `content = [system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_command_failed:RESERVE_OPEN_CARD:gameNotStarted`
  - `clientContext.matchId = pTk7LHZdlZn`
  - `errorContext.message = active-turn-legal-only:follow-up-advance:legal_action_command_failed:RESERVE_OPEN_CARD:gameNotStarted`
- `stateSnapshot` 里已经有：
  - `matchId`
  - `gameId`
  - `playerId`
  - `reason`
  - `trackerKey`
  - `phase`
  - `currentPlayerId`
  - `legalActions`
  - `aiDecisionPreview`
- `aiDecisionPreview` 已明确给出：
  - `chosenAction.kind = reserve-open`
  - `chosenAction.commandTypes = ["RESERVE_OPEN_CARD"]`
- 这说明反馈链的诊断证据是够的，问题在 watchdog 恢复边界，不在反馈库本身。

## 修改

- `src/engine/transport/onlineAiRecovery.ts`
  - 未开局且非 `factionSelect` 的场景，不再进入 active-turn AI legal-action recovery。
- `src/engine/transport/server.ts`
  - `hostStarted=false` 的 public pregame 只保留 `factionSelect` 这类公开 setup 场景，避免误把普通开局前局面当成可代发 AI 动作。
- `src/games/splendor/ai.ts`
  - 未开局或游戏结束时直接返回空 legal actions，避免 AI runtime 自己产出会被领域层拒绝的动作。
- 镜像路径：
  - `e2e/src/engine/transport/onlineAiRecovery.ts`
  - `e2e/src/engine/transport/server.ts`
  - `e2e/src/games/splendor/ai.ts`

## 验证

- `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/server.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts src/games/splendor/ai.ts src/games/splendor/__tests__/smoke.test.ts`
- `npx eslint e2e/src/engine/transport/onlineAiRecovery.ts e2e/src/engine/transport/server.ts e2e/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts e2e/src/engine/transport/__tests__/server.test.ts e2e/src/games/splendor/ai.ts e2e/src/games/splendor/__tests__/smoke.test.ts e2e/feedback-real-submission.e2e.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/games/splendor/__tests__/smoke.test.ts --configLoader native --maxWorkers 1 --testNamePattern "Splendor 未开局|AI 未开局|Splendor 即使残留"`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "Splendor 未开局时不得代 AI|强制恢复命令失败时|自动反馈应携带交互选项|自动反馈应携带 AI 决策预览|默认上报链路不应把成功恢复类事件"`

## 备注

- 当前用户口径“最近都没有反馈”不成立；生产最近仍有反馈，只是系统 AI 那条 open 反馈指向的是 Splendor pregame watchdog 边界问题。
- 状态回写：`6a05e66129cd213e03bfd82f` 已于 `2026-05-15T15:38:58.914Z` 从 `open` 回写为 `resolved`。
- 回写依据：根因已定位，代码修复已落地，聚焦 lint / Vitest / 真实反馈 E2E 已通过；部署与后续线上观察作为发布待办，不作为该反馈保持 `open/in_progress` 的前置条件。
