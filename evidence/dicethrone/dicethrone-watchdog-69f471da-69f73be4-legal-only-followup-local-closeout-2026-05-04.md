# Dice Throne watchdog `69f471da` / `69f73be4` 本地验收收口说明（2026-05-04）

> 2026-06-06 当前有效口径：本文只对应 watchdog 反馈 `69f471da / 69f73be4` 这一组本地 closeout 记录，不是当前 DiceThrone 所有 `legal-only followup` / `legal_action_unavailable` 问题都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它理解成单条反馈簇的历史验收记录。

## 反馈对象

- `69f471da9ec13b96d7109902`
- `69f73be49ec13b96d710f1c2`
- 来源：`online-ai-watchdog`
- 文案一致：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`

## 线上当前还能确认到什么

- 这两条系统单都只剩 watchdog 聚合摘要：
  - `route = server-watchdog`
  - `mode = online`
  - `errorName = force-end-turn-failed`
  - `errorMessage = active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 两条记录都没有还能继续复核的真实对局交互现场：
  - `phase = null`
  - `flowHalted = null`
  - `pendingInteractionId = null`
  - `pendingBonusDiceSettlement = false`
  - `pendingAttack = false`
- 当前只剩 occurrence 聚合值：
  - `69f471da...`: `occurrenceCount = 2563`，`lastOccurredAt = 2026-05-03T17:40:31.141Z`
  - `69f73be4...`: `occurrenceCount = 2`，`lastOccurredAt = 2026-05-03T12:16:02.934Z`

这说明它们现在已经不是“还能从线上残局直接看出新根因”的 open 现场，而是 **旧 watchdog 聚合项仍未人工回写**。

## 与已修簇的关系

- 这两条系统单的 reason 正好命中 DiceThrone 本轮已修 transport/watchdog 链的目标文案：
  - `active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 对应修复与证据已经存在：
  - `evidence/transport/online-ai-watchdog-targetingroll-legal-only-fix-2026-04-30.md`
    - 说明 DiceThrone `targetingRoll / offensiveRoll / defensiveRoll` 不再对 legal-only 场景 fallback 到裸 `ADVANCE_PHASE`
    - 失败文案从旧的 `command_failed` 收敛成 `legal_action_unavailable`
  - `evidence/dicethrone/dicethrone-online-ai-watchdog-human-response-window-fix-2026-05-02.md`
    - 修正 human 响应窗口被误判成 `active-turn-legal-only` 的 transport 问题
  - `evidence/dicethrone/dicethrone-online-ai-orphan-displayonly-bonus-settlement-fix-2026-05-02.md`
    - 修正 orphan `displayOnly` 奖励骰残留导致 watchdog 无法收口的问题
  - `evidence/dicethrone/dicethrone-feedback-69f21b05-ai-stall-targetingroll-loaded-local-closeout-2026-05-04.md`
    - 已明确把同簇 human 反馈收口到 `displayOnly / hidden response / targetingRoll` 修复链

## 本轮 fresh 复核

- 本轮重新跑通 transport 聚焦回归：
  - `src/engine/transport/__tests__/server.test.ts`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`
    - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
    - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`
    - `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`
- 以及底层 roll/seat 判定单测：
  - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`

## 结论

- 这两条不是新的独立线上残局，而是 DiceThrone watchdog 已修簇遗留的系统聚合 open。
- 当前本地 transport 修复链已经覆盖：
  - roll 阶段 legal-only 不再裸推进
  - human response window 不再误判成 AI 卡死
  - orphan `displayOnly` 奖励骰残留可被 watchdog 继续收口
- 在只剩旧聚合摘要、无新现场可复核的前提下，本条按“已修未回写的系统单”处理，直接转 `resolved`。

## 收口口径

- 当前任务口径下，`resolved` 表示“本地已经确认并完成本地验收”，不代表已上传/已上线。
- 这两条可作为同一 DiceThrone watchdog 修复簇残留 open，一并回写 `resolved`。
