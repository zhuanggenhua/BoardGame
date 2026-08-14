# Dice Throne AI 交互全链路历史审计（2026-04-12）

> 2026-06-06 当前有效口径：本文是 2026-04-12 那轮以静态读码为主的 AI 交互全链路历史审计，只能证明当时看到的结构风险与链路判断，不是当前 DiceThrone AI 现状、更不是当前新英雄补审的完成证明。尤其本文正文已明确“本轮未运行测试、未启动服务”，阅读时不得把它当作当前动态状态的直接证据。

## 1. 审计范围
- AI 决策与 legal actions：`src/games/dicethrone/ai.ts`
- Dice Throne 响应窗口打开链：`src/games/dicethrone/domain/execute.ts`、`src/games/dicethrone/domain/executeCards.ts`
- 响应窗口 guard / 规则过滤：`src/games/dicethrone/domain/responseWindowGuards.ts`、`src/games/dicethrone/domain/rules.ts`
- 事件与音效映射：`src/games/dicethrone/domain/events.ts`
- Dice Throne core reduce：`src/games/dicethrone/domain/reducer.ts`
- 引擎响应窗口系统：`src/engine/systems/ResponseWindowSystem.ts`
- 在线 AI watchdog / 自动反馈：`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/server.ts`

## 2. 权威来源
- 审计规范：`.spec/knowledge/standards/testing-audit.md`
- 当前仓库实现代码与注释（仅静态读码）

## 3. 审计方法与限制
- 本轮只做静态审计与证据留档，**未运行测试、未启动服务、未注入状态**。
- 结论仅针对当前工作区可见源码，不替代动态验证。
- 本轮不改引擎、不改业务代码，只修订审计文档。

## 4. 关键触发链路 / 关键函数 / 关键事件

### 4.1 确认骰面 → 打开响应窗口
1. AI 在掷骰阶段会生成 `confirm-roll` 行为：`src/games/dicethrone/ai.ts:1756-1762`
2. `CONFIRM_ROLL` 在领域执行器中先发出 `ROLL_CONFIRMED`：`src/games/dicethrone/domain/execute.ts:397-406`
3. 执行器立即用 `applyEvents(..., [ROLL_CONFIRMED], reduce)` 计算确认后的状态，再调用 `hasAfterRollConfirmedWindowBeenHandled()`：`src/games/dicethrone/domain/execute.ts:413-416`
4. 若 guard 未命中，则调用 `getResponderQueue(..., 'afterRollConfirmed', ..., excludeId = rollerId)` 组装响应者队列：`src/games/dicethrone/domain/execute.ts:419-427`
5. 若队列非空且自动响应开启，则发出 `RESPONSE_WINDOW_OPENED`：`src/games/dicethrone/domain/execute.ts:428-441`
6. 响应窗口系统基于 `buildResponseWindowFingerprint()` / `isSemanticallyEquivalentWindow()` 去重：`src/engine/systems/ResponseWindowSystem.ts:145-157,228-233,645-701`

**关键函数**：
- `execute()`
- `hasAfterRollConfirmedWindowBeenHandled()`
- `getResponderQueue()`
- `buildResponseWindowFingerprint()`
- `isSemanticallyEquivalentWindow()`

**关键事件**：
- `ROLL_CONFIRMED`
- `RESPONSE_WINDOW_OPENED`
- `RESPONSE_WINDOW_CLOSED`

### 4.2 响应中改骰 → 再确认 → 再开窗口
1. 骰子被修改时进入 `handleDieModified()`：`src/games/dicethrone/domain/reducer.ts:667-682`
2. 骰子被重掷时进入 `handleDieRerolled()`：`src/games/dicethrone/domain/reducer.ts:691-705`
3. 两者都会在“修改者等于当前 roller 且原本已确认”的前提下，把 `rollConfirmed` 重置为 `false`：`src/games/dicethrone/domain/reducer.ts:678-680,702-704`
4. AI 仍然持有 `confirm-roll` 动作入口：`src/games/dicethrone/ai.ts:1756-1762`
5. 再次 `CONFIRM_ROLL` 后，会按 4.1 重新走一遍打开 `afterRollConfirmed` 窗口的链路。

**关键函数**：
- `handleDieModified()`
- `handleDieRerolled()`
- `buildPhaseActions()`

**关键事件**：
- `DIE_MODIFIED`
- `DIE_REROLLED`
- `ROLL_CONFIRMED`
- `RESPONSE_WINDOW_OPENED`

### 4.3 watchdog / 自动反馈 / 强制兜底
1. watchdog 用 `buildAiProgressMarker()` 记录当前位置：`src/engine/transport/onlineAiRecovery.ts:149-187`
2. 当前 marker 已不再直接依赖 `responseWindowId`，而是依赖 `buildResponseWindowFingerprint(responseWindow)` + responderId + responderIndex：`src/engine/transport/onlineAiRecovery.ts:158-186`
3. 服务端再用 `buildOnlineAiRecoveryFingerprint()` 为 `response-window` / `response-loop` 生成恢复指纹：`src/engine/transport/server.ts:1242-1315`
4. 若当前响应者是 human，watchdog 会直接 `return null`，不会替真人执行响应或强制推进：`src/engine/transport/onlineAiRecovery.ts:755-760`
5. 同一 `response-window` 连续失败后，服务端会升级为 `response-loop`，并改用 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`：`src/engine/transport/server.ts:898-940`
6. 对“无解交互”自动上报时，会附带 `seatSelectability` 与 `seatUnsatisfiableReason`：`src/engine/transport/server.ts:1338-1363,2081-2100`

**关键函数**：
- `buildAiProgressMarker()`
- `resolveForceEndTurnForStalledAi()`
- `buildOnlineAiRecoveryFingerprint()`
- `buildUnsatisfiableInteractionStateSnapshot()`
- `resolveUnsatisfiableReasonFromInteraction()`
- `resolveForceEndTurnForStalledAi()` 的 human-responder 门禁

**关键事件 / 命令 / 原因码**：
- `RESPONSE_PASS`
- `SYS_RESPONSE_WINDOW_FORCE_CLOSE`
- `unsatisfiable-interaction-auto-skipped`
- `response-window`
- `response-loop`
- `action-loop`
- `empty-options`
- `all-options-disabled`
- `min-selection-unreachable`

### 4.4 弃牌 / 卖牌 / 推阶段动作链
1. AI 在弃牌阶段会持续生成 `discard-card`：`src/games/dicethrone/ai.ts:1678-1690`
2. AI 在主阶段仍会生成 `sell-card`：`src/games/dicethrone/ai.ts:1799-1810`
3. AI **已不再生成** `UNDO_SELL_CARD`：`src/games/dicethrone/ai.ts:1814-1817`
4. AI 在可推进阶段会同时生成 `advance-phase`：`src/games/dicethrone/ai.ts:1836-1844`
5. watchdog 仅在动作日志形成 `repeat` / `alternating` 模式时，才把这类循环认定为 `action-loop`：`src/engine/transport/onlineAiRecovery.ts:229-269,765-779`

## 5. 逐项结论

### 5.1 [高风险] `afterRollConfirmed` 重触发根链仍成立（D8 / D9 / D39 / D45）
**结论**：静态上，“确认骰面 → 响应窗口 → 响应里改骰 → 再确认 → 再开同类窗口”的链路仍然成立，这就是“跳过后立刻又出现响应窗口”的根根因候选之一。

**证据**：
- `ROLL_CONFIRMED` 每次执行都会进入“应用确认事件后再判断是否开窗”的逻辑：`src/games/dicethrone/domain/execute.ts:397-441`
- guard 只认 `rollConfirmedSequence === afterRollResponseWindowSequence`：`src/games/dicethrone/domain/responseWindowGuards.ts:25-30`
- `ROLL_CONFIRMED` 会递增 `rollConfirmedSequence`：`src/games/dicethrone/domain/reducer.ts:143-147`
- `RESPONSE_WINDOW_OPENED` 会把 `afterRollResponseWindowSequence` 记成当前 `rollConfirmedSequence`：`src/games/dicethrone/domain/reducer.ts:611-620`
- 但只要 roller 在后续链路中发生 `DIE_MODIFIED` / `DIE_REROLLED`，`rollConfirmed` 就会被重置为 `false`，为再次确认打开入口：`src/games/dicethrone/domain/reducer.ts:667-705`

**影响解释**：
- 这不是单纯 UI 重绘问题，而是事件 / reducer / response-window 三层共同允许的**真实重入链**。
- 当前 `ResponseWindowSystem` 的“语义等价窗口去重”只能拦截同语义 reopen，但前提是 reopen 的窗口指纹仍等价；一旦业务链产生新的确认序号，Dice Throne 自身 guard 仍会允许重新开窗。

**建议修复点（仅建议，不改代码）**：
- 为同一次“确认后的响应期”引入独立业务链 ID / 结算批次 ID，而不是只靠 `rollConfirmedSequence`；
- 或对“改骰后再确认”的 reopen 增加更严格的语义门禁：只有骰面语义真的变化并且未消费过时才允许 reopen。

### 5.2 [高风险] “AI 自己确认骰面 / 响应音效循环”更像事件重复，不是 AI 以响应者身份响应自己（D8 / D15 / D45）
**结论**：静态上，Dice Throne 已明确排除了 roller 作为 `afterRollConfirmed` 的响应者，因此“AI 响应自己确认骰面”不是当前最像的解释；更像是 `ROLL_CONFIRMED` / `RESPONSE_WINDOW_OPENED` 被反复触发，导致你听到响应音效不断循环。

**证据**：
- 打开 `afterRollConfirmed` 窗口时显式把 `rollerId` 作为 `excludeId` 排除出响应队列：`src/games/dicethrone/domain/execute.ts:419-427`
- 规则层也明确禁止 roller 在 `afterRollConfirmed` 中出牌：`src/games/dicethrone/domain/rules.ts:1193-1224`
- `ROLL_CONFIRMED` 和 `RESPONSE_WINDOW_OPENED` 都配置为 `audio: 'immediate'`：`src/games/dicethrone/domain/events.ts:77-100`

**影响解释**：
- 如果同一业务链反复发出 `ROLL_CONFIRMED` / `RESPONSE_WINDOW_OPENED`，音频层会忠实重复播放；这更接近“事件风暴”而不是“音频层单独出 bug”。

**建议修复点（仅建议，不改代码）**：
- 排查重复事件源，而不是先改音效层；
- 对 `ROLL_CONFIRMED` / `RESPONSE_WINDOW_OPENED` 增加链路级别的可观测字段，便于区分“真实新窗口”与“重复 reopen”。

### 5.3 [中高风险] watchdog 并非完全无兜底，但 tracker/fingerprint 仍可能把同一事故拆桶，导致“看起来没触发”（D9 / D39 / D45）
**结论**：旧结论“progressMarker 直接依赖 `responseWindowId` 导致假进展”已经失效；当前实现已改成基于响应窗口 fingerprint。但 watchdog 仍可能因为 `response-window` / `response-loop` / `action-loop` 原因切换、当前响应者变化、队列签名变化等因素，把同一事故链拆成不同 tracker，导致用户体感为“兜底没有命中”。

**证据**：
- `buildAiProgressMarker()` 现在使用的是 `buildResponseWindowFingerprint(responseWindow)`，不是原始 `windowId`：`src/engine/transport/onlineAiRecovery.ts:158-186`
- 当当前响应者是 human 时，watchdog 会直接放弃接管，因此这条兜底静态上不会替真人玩家执行响应：`src/engine/transport/onlineAiRecovery.ts:755-760`
- 服务端的 `trackerKey = playerId + reason + recoveryFingerprint`：`src/engine/transport/server.ts:892-945`
- `response-window` 连续失败后，才会升级成 `response-loop` 并强制 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`：`src/engine/transport/server.ts:898-940`
- `buildOnlineAiRecoveryFingerprint()` 对 `response-window` / `response-loop` 使用的是 `reason + responderId + phase + windowType + queueSignature`：`src/engine/transport/server.ts:1294-1315`

**影响解释**：
- 兜底不是没有，而是**命中条件偏窄**；同一链路如果在恢复尝试前后切换了 `reason`、当前响应者或队列签名，就可能重新记为一条“新事故”。

**建议修复点（仅建议，不改代码）**：
- 将 `response-window` 与 `response-loop` 归并到更稳定的同源事故 key；
- 对同一回合 / 同一 phase / 同一 response-window family 做更强的一致事故归并。

### 5.4 [中风险] `afterCardPlayed` 仍是“实现保留、规则封死”的分叉链（D3 / D23 / D33）
**结论**：Dice Throne 当前代码里保留了 `afterCardPlayed` 响应窗口的打开逻辑与 guard，但规则层实际上把此窗口下的卡牌可用性直接封死，因此这是一个结构保留链，而不是当前稳定可用链。

**证据**：
- `executeCards.ts` 在普通出牌后仍会调用 `getResponderQueue(..., 'afterCardPlayed', ...)` 并尝试发 `RESPONSE_WINDOW_OPENED`：`src/games/dicethrone/domain/executeCards.ts:247-270`
- 规则层 `isCardPlayableInResponseWindow(..., 'afterCardPlayed', ...)` 直接 `return false`：`src/games/dicethrone/domain/rules.ts:1227-1231`
- `hasRespondableContent()` 又完全复用了这个规则：`src/games/dicethrone/domain/rules.ts:1344-1376`

**影响解释**：
- 当前大概率不会真的形成 `afterCardPlayed` 响应链，但保留的开窗代码会让未来维护者误判“这条链已经完整可用”。

**建议修复点（仅建议，不改代码）**：
- 要么删除这条预留链；
- 要么补齐明确规则和可响应语义，避免“实现看起来有，规则层实际封死”。

---

## 修订记录

- 2026-04-12：落实“骰面签名去重”补丁：在 afterRollConfirmed 打开时记录 `afterRollResponseWindowSignature`，CONFIRM_ROLL 若骰面签名已处理则不再重复打开响应窗口。新增/回归：
  - `src/games/dicethrone/__tests__/flow.test.ts` 用例：`源头级去重：骰面签名已处理时，不应重复打开 afterRollConfirmed`

### 5.5 [中高风险] 弃牌 / 卖牌 / 推阶段循环没有从根因上消除，主要仍靠 action-loop 兜底（D9 / D39 / D43 / D45）
**结论**：当前 AI 确实已经移除了 `UNDO_SELL_CARD` 的生成，因此“卖牌 ↔ 撤回卖牌”这条老循环在当前静态代码里不再是主路径；但 `discard-card` / `sell-card` / `advance-phase` 这些动作仍可能构成新的重复或交替循环，而根因消除仍主要依赖 watchdog 的 `action-loop` 识别。

**证据**：
- `buildPhaseActions()` 仍会生成 `discard-card`、`sell-card`、`advance-phase`：`src/games/dicethrone/ai.ts:1678-1690,1799-1810,1836-1844`
- AI 已明确不生成 `UNDO_SELL_CARD`：`src/games/dicethrone/ai.ts:1814-1817`
- watchdog 仅在最近 action log 命中 `repeat` 或 `alternating` 时，才认定为 `action-loop`：`src/engine/transport/onlineAiRecovery.ts:229-269,765-779`

**影响解释**：
- 这说明当前策略更偏“事后止损”，而不是“先在合法动作集合层去除会制造循环的低价值动作组合”。

**建议修复点（仅建议，不改代码）**：
- 为 discard / sell / advance-phase 增加更强的上下文门禁；
- 将“无信息增益的交替动作”在 AI legal action / 评分层直接降为不可选，而不是完全指望 watchdog 兜底。

### 5.6 [已具备能力] 自动反馈会携带“为什么无解”的信息（D3 / D39）
**结论**：自动反馈链已经携带“为什么无法选择”的信息；这不是本轮新增，而是当前代码中已经具备的能力。

**证据**：
- `resolveUnsatisfiableReasonFromInteraction()` 可解析 `empty-options` / `all-options-disabled` / `min-selection-unreachable`：`src/engine/transport/onlineAiRecovery.ts:477-559`
- `unsatisfiable-interaction-auto-skipped` 上报会带上 `reason`、`trackerKey`、`stateSnapshot`、`actionLog`：`src/engine/transport/server.ts:2081-2100`
- `stateSnapshot` 内含 `seatSelectability` 与 `seatUnsatisfiableReason`：`src/engine/transport/server.ts:1338-1363`

**影响解释**：
- 如果后续仍出现“明明不是无解却被 auto-skip”的问题，排查重点应放在“为什么它被归类成 unsatisfiable”而不是“有没有带原因上报”。

## 6. 命中审计维度
- **D3 数据流闭环**：AI legal action → command → event → reducer → response window → watchdog / feedback 是否闭环。
- **D8 时序正确**：确认骰面后何时开窗、改骰后何时重置确认、何时再次确认。
- **D9 幂等与重入**：重复确认 / reopen / 强制恢复是否会被拆成新事故。
- **D15 UI 状态同步**：音效循环是否来自真实事件重复，而不是单独 UI/音频假象。
- **D23 架构假设一致性**：预留响应窗口与当前规则是否一致。
- **D33 语义分叉建模**：`afterCardPlayed` 的“实现存在 / 规则封死”分叉。
- **D39 操作后卡住 / 无法继续**：响应窗口、弃牌/推进阶段动作链是否会卡住。
- **D45 重复触发 / 重入**：确认骰面与响应窗口链的重复打开、watchdog 追踪拆桶。

## 7. 修订记录（对旧审计结论的回写）
1. **旧结论失效：**“watchdog progressMarker 直接依赖 `responseWindowId`，所以 timestamp 窗口一定导致假进展。”
   - **修订后：**当前 `buildAiProgressMarker()` 已改为使用 `buildResponseWindowFingerprint(responseWindow)`，旧结论不再准确；真正的剩余风险是 tracker/fingerprint 仍可能因 reason / responder / queueSignature 变化而拆桶。
2. **补充明确：**当前静态代码已显式移除 AI `UNDO_SELL_CARD` 生成，因此“卖牌 ↔ 撤回卖牌”不再是当前主路径；但 discard/sell/advance-phase 仍存在新的动作循环风险。
3. **补充明确：**“AI 响应自己的确认骰面”静态上不成立；更像是重复的 `ROLL_CONFIRMED` / `RESPONSE_WINDOW_OPENED` 事件带来的音效循环。

## 8. 建议修复点（仅审计建议）
1. 把“确认骰面后的响应期”提升为独立结算域，避免 `rollConfirmedSequence` 被当作唯一 reopen 凭据。
2. 统一 `response-window` / `response-loop` 的事故归并键，避免同一事故在 watchdog 中反复开新 tracker。
3. 在 AI legal action 或 scorer 层压制“无信息增益的 discard/sell/advance-phase 交替动作”，不要只依赖 action-loop 兜底。
4. 清理 `afterCardPlayed` 这条预留链，或补齐真正可执行的规则合同。
5. 为 `ROLL_CONFIRMED` / `RESPONSE_WINDOW_OPENED` 增加更强的链路追踪字段，便于区分“真正新窗口”和“重复 reopen”。

## 9. 未覆盖风险
- 本轮未做动态验证，不能确认具体某个英雄/卡牌组合一定触发上述循环，只能确认这些结构风险在静态上成立。
- `DIE_MODIFIED` / `DIE_REROLLED` 的真实来源卡牌组合较多，本轮未逐卡枚举到具体英雄/具体牌面。
- 仅覆盖 Dice Throne；未顺带扩审 Smash Up / Summoner Wars。

---

**当前阅读说明**：本文只能作为“当时静态审计看到什么”的历史证据，不能外推成当前 runtime 行为已被动态验证，也不能替代后续专项修复文档或当前主审计结论。
