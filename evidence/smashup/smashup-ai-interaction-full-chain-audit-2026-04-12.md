# Smash Up AI 交互全链路审计（2026-04-12）

## 审计范围

本轮只做**静态审计与证据归档**，不改实现、不改测试、不重跑 E2E。

覆盖的 AI 可见交互链：

- `interaction`：`sys.interaction.current` 的创建、排队、解决、取消
- `responseWindow`：`sys.responseWindow.current` 的打开、推进、关闭、锁定
- `phase advance`：`ADVANCE_PHASE` 的合法性门禁与自动推进
- `afterScoring`：计分后响应窗口、延迟事件传递、重新结算
- `flowHalted` / `awaiting-post-reduce`：阶段推进停/放行条件
- `postProcessSystemEvents`：系统事件后处理的职责边界

## 权威来源

1. `.spec/knowledge/standards/testing-audit.md`
2. `src/engine/ai/snapshots.ts`
3. `src/engine/ai/context.ts`
4. `src/games/smashup/ai.ts`
5. `src/games/smashup/game.ts`
6. `src/games/smashup/domain/index.ts`
7. `src/games/smashup/domain/systems.ts`
8. `src/engine/systems/InteractionSystem.ts`
9. `src/engine/systems/SimpleChoiceSystem.ts`
10. `src/engine/systems/ResponseWindowSystem.ts`
11. `src/engine/pipeline.ts`
12. 既有测试/证据文档：
   - `src/games/smashup/__tests__/audit-interaction-chain.property.test.ts`
   - `src/games/smashup/__tests__/interactionCompletenessAudit.test.ts`
   - `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`
   - `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
   - `evidence/smashup/response-window-pass-logic-verified.md`
   - `evidence/smashup/smashup-after-scoring-complete-fix.md`
   - `evidence/smashup/smashup-ai-interaction-audit-2026-04-12.md`

## 交互链梳理

### 1) AI 视角：先看见什么，再决定什么

- `extractAiInteractionSnapshot()` 会直接读取 `sys.interaction.current`，把当前交互暴露给 AI 视角。
  - 证据：`src/engine/ai/snapshots.ts:10-65`
- `extractAiResponseWindowSnapshot()` 会直接读取 `sys.responseWindow.current`，把响应窗口暴露给 AI 视角。
  - 证据：`src/engine/ai/snapshots.ts:67-90`
- `buildAiDecisionContext()` 同时注入 `interaction` 与 `responseWindow`。
  - 证据：`src/engine/ai/context.ts:97-115`

**结论**：AI 不是只看单一阶段态，而是同时看见 `interaction` 与 `responseWindow` 两类阻塞源。`D3/D5` 通过。

### 2) AI 动作排序：交互优先，其次响应窗口，再到阶段动作

- `buildSmashUpAiLegalActions()` 的优先级是：
  1. `interactionActions`
  2. `responseActions`
  3. 当前玩家常规动作
  4. `ADVANCE_PHASE`
  - 证据：`src/games/smashup/ai.ts:1425-1469`
- `canAdvancePhase()` 明确拒绝：
  - `sys.interaction.current` 存在
  - `sys.responseWindow.current` 存在
  - `scoreBases` 阶段仍有待处理 special
  - 证据：`src/games/smashup/ai.ts:264-282`

**结论**：AI 不会在交互/响应窗口未清时抢跑推进阶段。`D8/D39` 通过。

### 3) interaction 解决：RESOLVED / CANCELLED 都有消费链

- `resolveInteraction()` 会把当前交互收口，并把 `_deferredPostScoringEvents` 继续传给下一个交互，避免链式丢失。
  - 证据：`src/engine/systems/InteractionSystem.ts:703-767`
- `SimpleChoiceSystem` 会在正常响应时发 `SYS_INTERACTION_RESOLVED`，在 emergency skip/cancel 时发 `SYS_INTERACTION_CANCELLED`。
  - 证据：`src/engine/systems/SimpleChoiceSystem.ts:93-120`、`src/engine/systems/SimpleChoiceSystem.ts:275-330`
- SmashUp 专用事件系统同时消费 `RESOLVED` 和 `CANCELLED`，并对取消值做归一化。
  - 证据：`src/games/smashup/domain/systems.ts:291-366`

**结论**：当前不是“只关窗不善后”的状态；取消事件已经进入域内消费链。`D9/D3` 通过。

### 4) responseWindow：推进、锁定、关闭都在同一条系统链里

- `ResponseWindowSystem` 负责：
  - 打开窗口
  - `RESPONSE_PASS` 之后推进到下一个响应者
  - `loopUntilAllPass` 循环
  - `interactionLock` 锁定
  - `hasRespondableContent` 跳过无效响应者
  - 去重与冷却
  - 证据：`src/engine/systems/ResponseWindowSystem.ts:429-1057`
- `ResponseWindowSystem` 还明确在 `beforeCommand` 中阻止 `RESPONSE_PASS` 与当前交互冲突。
  - 证据：`src/engine/systems/ResponseWindowSystem.ts:487-548`

**结论**：响应窗口自身的推进与阻塞逻辑是闭环的，不依赖外部猜测。`D8/D39` 通过。

### 5) afterScoring：先开窗口，再补发延迟事件，再允许阶段继续

- `scoreOneBase()` 会：
  - 先收集 `afterScoring` 触发
  - 记录 `afterScoringInitialPowers`
  - 把延迟清场/换基地等事件序列化进 `deferredPostScoringEvents`
  - 若有响应牌，则打开 `afterScoring` 响应窗口
  - 若有交互，则把延迟事件附着到首个交互的 `continuationContext`
  - 证据：`src/games/smashup/domain/index.ts:694-905`
- `attachDeferredPostScoringEventsToFirstInteraction()` 会把延迟事件挂到首个交互/队首交互上。
  - 证据：`src/games/smashup/domain/index.ts:112-123`
- `onPhaseExit('scoreBases')` 会在 `interaction.current` / `responseWindow.current` / `awaiting-post-reduce` 未清时保持 halt。
  - 证据：`src/games/smashup/domain/index.ts:1217-1345`
- `onAutoContinueCheck('scoreBases')` 也会在 `responseWindow.current`、`_waitForPostScoringReduce`、`awaiting-post-reduce` 未清时拒绝自动推进。
  - 证据：`src/games/smashup/domain/index.ts:1606-1656`

**结论**：`afterScoring` 不是“开窗后就自动往前跑”的链路；它与交互/响应窗口是同一条阻塞链。`D8/D39/D45` 通过。

### 6) 系统后处理职责：当前已收敛回 pipeline

- SmashUp 事件系统的注释已明确：`postProcessSystemEvents` 由 pipeline 统一调用，系统层不再手动调用。
  - 证据：`src/games/smashup/domain/systems.ts:360-366`
- pipeline 的职责分界是：
  - 4.5：命令执行后的领域后处理
  - afterEvents：系统 afterEvents 的多轮后处理
  - 证据：`src/engine/pipeline.ts:313-705`

**结论**：当前未见 SmashUp 域内再次手动调用 `postProcessSystemEvents` 的重复职责冲突。`D41/D45` 通过。

## 逐项结论

| 维度 | 结论 | 证据摘要 |
|---|---|---|
| D3 数据流闭环 | ✅ 通过 | AI 视角同时读取 interaction/responseWindow，域内与引擎层链路可互相对齐 |
| D5 交互完整 | ✅ 通过 | AI 优先响应交互，其次响应窗口；阶段动作受阻塞门禁保护 |
| D8 时序正确 | ✅ 通过 | interaction / responseWindow / afterScoring 的时序门禁一致 |
| D9 幂等与重入 | ✅ 通过 | resolveInteraction 传递 deferred 事件；CANCELLED 也有消费链 |
| D39 流程控制标志清除完整性 | ✅ 通过 | scoreBases 的 halt 只在阻塞源清空后放行 |
| D41 系统职责重叠 | ✅ 通过 | SmashUp 域层不再手动后处理，职责回到 pipeline |
| D45 Pipeline 多阶段调用去重 | ✅ 通过 | 4.5 与 afterEvents 的边界清晰，未见域层重复调用后处理 |

## 风险与未覆盖项

1. **本轮未重跑动态测试/E2E**：这是静态审计，不能替代真实回归验证。
2. **`_waitForPostScoringReduce` 仍是遗留读分支**：当前仅看到读取，没有看到本轮新增写入链，属于技术债，不是本轮确认的功能 bug。
3. **未逐卡复核所有 sourceId/handler 的实时表现**：已依赖现有交互完整性测试与既有证据文档，但未重新跑它们。
4. **UI/视觉层未审**：本轮只审 AI 可见状态与引擎链路，不审布局/动画/截图。

## 待改进

- 建议后续补跑以下回归，以把本轮静态结论升级为动态证据：
  - `src/games/smashup/__tests__/interactionCompletenessAudit.test.ts`
  - `src/games/smashup/__tests__/audit-interaction-chain.property.test.ts`
  - `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`
  - `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
  - `evidence/smashup/response-window-pass-logic-verified.md` 对应的 E2E 路径
- 若后续确认 `_waitForPostScoringReduce` 确实没有任何写入方，可考虑清理这条死分支，减少误判成本。

## 验证/证据来源

本轮证据来自以下两类材料：

### A. 代码静态证据

- `src/engine/ai/snapshots.ts:10-90`
- `src/engine/ai/context.ts:97-115`
- `src/games/smashup/ai.ts:264-282, 1425-1469`
- `src/engine/systems/InteractionSystem.ts:703-767, 1193-1200`
- `src/engine/systems/SimpleChoiceSystem.ts:93-120, 275-330`
- `src/engine/systems/ResponseWindowSystem.ts:429-1057`
- `src/games/smashup/domain/index.ts:112-123, 694-905, 1217-1656`
- `src/games/smashup/domain/systems.ts:291-366`
- `src/engine/pipeline.ts:313-705`

### B. 既有测试/证据文档

- `src/games/smashup/__tests__/audit-interaction-chain.property.test.ts`
- `src/games/smashup/__tests__/interactionCompletenessAudit.test.ts`
- `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`
- `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- `evidence/smashup/response-window-pass-logic-verified.md`
- `evidence/smashup/smashup-after-scoring-complete-fix.md`
- `evidence/smashup/smashup-ai-interaction-audit-2026-04-12.md`

## 结论总览

当前 Smash Up 的 AI 可见交互链已经形成闭环：

- AI 能看见 `interaction` / `responseWindow`
- AI 不会在阻塞态下抢跑 `ADVANCE_PHASE`
- `RESOLVED` / `CANCELLED` 都有域内消费链
- `afterScoring` 会把延迟事件传递到后续交互/响应窗口
- 系统后处理职责已收敛回 pipeline

本轮未发现需要立刻改实现的结构性断点。
