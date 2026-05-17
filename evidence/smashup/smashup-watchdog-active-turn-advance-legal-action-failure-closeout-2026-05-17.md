# SmashUp watchdog active-turn ADVANCE_PHASE 失败收口（2026-05-17）

## 对象

- `69fff887316dbddba433aafc`
  - `matchId = OXT1F8AirUQ`
  - 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`
- `69fdd1d03b0e6d6909dd8262`
  - `matchId = xiWqKMhbpaQ`
  - 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`

## 现场事实

- 两条反馈的 `stateSnapshot` 共同特征：
  - `gameId = smashup`
  - `phase = playCards`
  - `reason = active-turn`
  - `interaction = null`
  - `responseWindow = null`
  - `legalActions.total = 1`
  - 唯一 legal action 为 `advance-phase:playCards:<playerId>`，命令类型只有 `ADVANCE_PHASE`
- `aiDecisionPreview` 也明确显示 watchdog 看到的最佳动作就是 `ADVANCE_PHASE`，不是“无动作”或“看不到 seat overlay”。

## 根因

- watchdog 主循环会先尝试 `tryRecoverOnlineAiWithLegalAction(...)`。
- 若这一步里的 legal action 已经执行到 `ADVANCE_PHASE`，但命令本身失败，旧逻辑仍会落回 `currentCandidate.resolution.action.commands[0]` 再打一遍同一个 `ADVANCE_PHASE`。
- 结果：
  - 没有得到更精确的失败诊断；
  - 自动反馈 reason 被吞成裸 `command_failed`；
  - 线上只留下“follow-up-advance command_failed”，看不出是 legal-action 自己先失败。

## 本轮修改

- 文件：[server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
- 调整：
  - 当 `tryRecoverOnlineAiWithLegalAction(...)` 返回 `legal-action-command-failed` 时，watchdog 立即按该结果上报失败；
  - 不再对同一条失败的 legal action 命令重复走 fallback。
- 结果口径：
  - 从旧的 `active-turn:follow-up-advance:command_failed`
  - 收敛为 `active-turn:follow-up-advance:legal_action_command_failed:ADVANCE_PHASE:<真实失败原因>`

## 回归测试

- 文件：[server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
- 新增用例：
  - `online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed`
- 我实际验证到的行为：
  - `executeCommandInternal('ADVANCE_PHASE')` 只被调用 1 次；
  - 自动反馈 reason 为
    `active-turn:follow-up-advance:legal_action_command_failed:ADVANCE_PHASE:pipeline_error: test advance denied`
  - 不再退化成裸 `command_failed`。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因|online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed"`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"`
- `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts`

## 结论

- 这两条 open 单暴露的是 watchdog 失败诊断口径过粗，而不是“已经知道 legal action 失败后还应继续重打一遍同命令”。
- 当前修复已把这类 active-turn / playCards / `ADVANCE_PHASE` 失败明确归类到 `legal_action_command_failed`，便于后续继续定位真实领域拒绝原因，也避免同命令二次重试制造误导性 `command_failed`。
