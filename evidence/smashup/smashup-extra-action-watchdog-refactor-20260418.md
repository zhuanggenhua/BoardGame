# Smash Up 额外战术 watchdog 重构验证（2026-04-18）

## 重构目标
- 消除“交互解堵后自动 `ADVANCE_PHASE`”造成的跳回合问题。
- 保留 watchdog 的“先解堵”能力，但禁止在该场景越权推进回合。

## 实施点
- 代码文件：`src/engine/transport/server.ts`
- 核心策略：
  - 当本次恢复链来自 `visible-interaction` / `hidden-interaction`，且已确认 `requiresConfirmedAdvancePhase`；
  - 链式下一个候选若是 `active-turn`，则强制改成 `legalActionOnly`，并清空 fallback 命令（不再允许自动 `ADVANCE_PHASE`）。
  - 当 legal-action 决策被 `stale-private-overlay` / `missing-private-overlay` 阻断时，watchdog 会在同一轮改用 **emergency playerView** 再试一次合法动作（仅限 `active-turn` / `visible-interaction` / `hidden-interaction`）。
  - 若仍被 private overlay 阻断，则触发一次受冷却保护的 `broadcastState` overlay resync（默认 1.5s 冷却），并把失败原因细分为 `private_overlay_stale` / `private_overlay_missing`，便于后续定位。
  - `resolveOnlineAiDecisionView` 增加 **event-stream epoch 硬约束**：`private-required` 决策下，`shared.sys.eventStream.nextId` 与 `privateOverlay.sys.eventStream.nextId` 必须一致；缺失或不一致直接判定 `stale-private-overlay`（不再仅靠 phase/turn 推断）。

## 验证命令
- `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`

## 关键验证用例（同文件）
1. `online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合`
2. `online AI watchdog 在额外战术交互中遇到 private overlay stale 时，不应 fallback 到 ADVANCE_PHASE`
3. `online AI watchdog 在 AI 当前阶段卡在 human 响应窗口时，应先强制关闭响应窗口再推进阶段`（确保 response-window 旧行为未被误伤）
4. `online AI watchdog 遇到 private overlay stale 时，应使用 emergency playerView 重试合法动作`
5. `online AI watchdog 触发 overlay resync 后应按冷却去重，避免连续广播风暴`
6. `online decision view（epoch 硬约束）`：
   - `private-required 场景下 eventStream.nextId 不一致时必须判定 stale-private-overlay`
   - `private-required 场景下 private overlay 缺失 eventStream.nextId 时必须判定 stale-private-overlay`

## 结果
- 两条 Smash Up 相关新用例都只执行 `SYS_INTERACTION_RESPOND(skip)`，不再执行 `ADVANCE_PHASE`。
- `turnNumber` 与 `activePlayerId` 保持在 AI 当前回合，不再“被跳过”。
- 在 `stale-private-overlay` 场景下，watchdog 可通过 emergency playerView 重试并恢复 legal action（而不是直接失败或越权推进回合）。
- 在 emergency 重试仍失败时，会触发一次 overlay resync 广播，且冷却期内不会重复广播。
- stale 判定已从“phase/turn/interaction 推断”为“event-stream epoch 硬约束 + 结构校验”。
- response-window 用例仍保持“force close -> advance”链路，回归通过。
- 全文件测试通过：`50 passed`。

## 证据日志（绝对路径）
- 重构验证日志：  
  `D:\gongzuo\webgame\BoardGame\test-results\refactor-smashup-extra-action-watchdog-20260418.log`
- 历史复现日志：  
  `D:\gongzuo\webgame\BoardGame\test-results\repro-smashup-extra-action-watchdog-20260418.log`

## 风险与后续
- 当前策略优先“防误跳回合”；若后续遇到 `legal_action_unavailable`，watchdog 会失败上报而不是强推回合。
- 后续可做的根治增强：
  1) 增加 `stale-private-overlay` 的聚合指标与告警；  
  2) 引入交互 epoch/lease，统一判定 overlay 新鲜度；  
  3) 仅在可证明安全时才允许 advance fallback。
