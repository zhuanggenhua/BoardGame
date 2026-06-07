# 2026-06-04 剩余 3 条 watchdog 系统反馈收口证据

## 范围

- `6a1ff26f78c1ecf399a67434`
  - DiceThrone
  - `[system][online-ai-watchdog] force-end-turn-failed response-loop:recover-interaction:legal_action_command_failed:RESPONSE_PASS:交互处理中，无法跳过响应`
- `6a200dd978c1ecf399a67819`
  - DiceThrone
  - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed:ADVANCE_PHASE:请先完成当前交互`
- `6a1d97dfc6e07188d8d19b79`
  - SmashUp
  - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed:SYS_INTERACTION_RESPOND:无效的选择`

## 现场事实

- 2026-06-04 生产聚合复核后，`open / in_progress` 只剩以上 3 条。
- 三条都属于 `online-ai-watchdog` 自动反馈，不是用户直报的新领域 bug。
- 本轮先对照 `temp/feedback-closeout/remaining-open-samples-2026-06-04.clean.json` 样本，再回查当前 worktree 里的 transport / watchdog 回归。

## 根因归类

### `6a1ff26f78c1ecf399a67434`

- 样本形状：
  - `gameId = dicethrone`
  - `reason = response-loop`
  - 唯一 legal action 是 `response:pass`
  - 失败文案是 `RESPONSE_PASS:交互处理中，无法跳过响应`
- 对应共享修复：
  - `src/engine/transport/__tests__/server.test.ts:11770`
  - 用例：`online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress`
- 结论：
  - 这条不是新的 DiceThrone 领域问题，而是 response-loop 在窗口 id 漂移时的 shared transport continuity / resolved 合同问题，当前代码已覆盖。

### `6a200dd978c1ecf399a67819`

- 样本形状：
  - `gameId = dicethrone`
  - `interaction.kind = dt:defender-choice`
  - `options = []`
  - `sharedUnsatisfiableReason = empty-options`
  - watchdog 看到的唯一 legal action 是 `ADVANCE_PHASE`
- 对应共享修复：
  - `src/engine/transport/__tests__/server.test.ts:23763`
  - 用例：`dt:defender-choice 已经是 0 个目标的恢复态时，不应再持久化系统反馈`
- 辅助诊断证据：
  - `src/engine/transport/__tests__/server.test.ts:21417`
  - 用例：`online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因`
- 结论：
  - 这条不是新的 DiceThrone 出牌/选目标逻辑 bug，而是 `dt:defender-choice` 已经进入空候选恢复态时，watchdog 旧反馈仍被持久化的系统噪音，当前代码已覆盖。

### `6a1d97dfc6e07188d8d19b79`

- 样本形状：
  - `gameId = smashup`
  - `interaction.kind = simple-choice`
  - `sourceId = smashup_reaction_choose`
  - `responseWindow.windowType = afterScoring`
  - `legalActions` 里只剩 `SYS_INTERACTION_RESPOND`
- 对应共享修复：
  - `evidence/smashup/smashup-feedback-6a2013a1-action-counter-watchdog-closeout-2026-06-04.md`
  - `src/engine/transport/__tests__/server.test.ts:11418`
  - 用例：`online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress`
- 辅助诊断证据：
  - `src/engine/transport/__tests__/server.test.ts:21417`
  - 用例：`online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因`
- 结论：
  - 这条不是 SmashUp `时空旅行者跳跃者（time_travelers_jumper）` afterScoring 反应链自身的新漏洞，而是 visible simple-choice 语义已漂移、但 watchdog 旧进度判定没有识别新 prompt 的 shared transport 问题，当前代码已覆盖。

## 本轮验证

- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress|online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress|online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因|dt:defender-choice 已经是 0 个目标的恢复态时，不应再持久化系统反馈"`
- `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`

## 收口结论

- 以上 3 条剩余系统单都已能被当前 worktree 的 watchdog / transport 修复链解释，并且都有对应回归证据。
- 本轮不再扩大代码改动面，只补台账并按 `resolved` 正式回写生产状态。
