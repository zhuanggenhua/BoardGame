# Game AI Adaptation Checklist

> 用于“加 AI / 改 AI / 修 AI 卡死”前后的快速核查。这里只写本仓库真实链路，不写通用空话。

## 1. InteractionSystem

- [ ] `createSimpleChoice()` 是否可能拿到空 options？
- [ ] 是否需要 `autoCancelOption` / skip / done / `multi.min=0`？
- [ ] `optionsGenerator` 是否需要 `autoRefresh`？
- [ ] 非 owner 在 `playerView` 中是否只会看到 `isBlocked=true`？
- [ ] 若 sharedState 没有 `current`，是否已经检查过 seat `playerView`？

## 2. ResponseWindowSystem

- [ ] 当前窗口允许的命令是否已放入 `allowedCommands` / `allowedCommandCategories`？
- [ ] 非当前 responder 的合法特例是否已走 `responderExemptCommands` 或 `allowNonResponderCommand`？
- [ ] `RESPONSE_PASS` 后是否真的会推进到下一个 responder 或关闭窗口？
- [ ] 同批事件中会不会 “推进 responder” 与 “重新打开窗口” 同时发生？
- [ ] `pendingInteractionId` 是否会导致窗口表面存在但无法 pass？

## 3. AI 决策层

- [ ] AI legal actions 是否完全来自合法命令，而非 UI 猜测？
- [ ] 同一规则状态下，真人可选择的并列动作（例如改写中间结果 / 重掷 / 确认 / 跳过 / 选择目标）是否都进入 AI legal actions？
- [ ] AI 策略不想选某个合法动作时，是否在评分层降权，而不是在合法动作枚举层让它消失？
- [ ] AI 会不会在已确认阶段仍生成前一阶段动作？
- [ ] AI 是否会把 undo/cancel/撤回类动作当收益动作反复选择？
- [ ] 同一 `interactionId / sourceId` 上是否需要“一次尝试后放弃”的 guard？

## 4. onlineAiRecovery / watchdog

- [ ] 当前卡住的 seat 是否确认是 AI？
- [ ] 是否已区分：
  - human 自己回合 → watchdog 返回 `null`
  - AI 当前阶段 + human responder → watchdog 走 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`
- [ ] hidden interaction 诊断是否拿到了各 AI seat 的 `playerView`？
- [ ] 自动反馈里是否有：
  - `interactionId`
  - `sourceId`
  - `legalActions` 摘要
  - `empty-options / all-options-disabled / min-selection-unreachable`

## 5. 文档与验证

- [ ] 测试是否补在最相关现有 `__tests__` 文件？
- [ ] evidence 是否写清：
  - 现象
  - 根因层级
  - AI-only guard
  - 不影响真人的理由

## 6. AI 动作延迟门控（新增）

- [ ] 是否明确区分“延迟时长”和“延迟动作范围”？
- [ ] `src/engine/transport/react.tsx` 与 `e2e/src/engine/transport/react.tsx` 的延迟门控是否一致？
- [ ] 静默动作是否已纳入 `NO_FOLLOW_UP_DELAY_ACTION_KINDS`（不再累计下一步 gate）？
- [ ] 可见动作是否保留节奏延迟（而不是全局都 0）？
- [ ] 是否用 `[LOCAL_AI_PERF]` 验证并记录：
  - 静默动作：`gateDelayMs=0`
  - 可见动作：`gateDelayMs≈minimumActionDelayMs`
