# Dice Throne AI 可见交互链历史审计（2026-04-12）

> 2026-06-06 当前有效口径：本文只覆盖 2026-04-12 那轮“AI 可见交互/响应窗口/阶段推进/撤回”链路的历史专项审计，不是当前 DiceThrone AI 全交互完成证明，也不是当前新英雄补审出口。阅读时必须把它当作一份局部链路审计文档，并结合后续修复与现行测试重新判断现状。

## 1. 审计范围
- AI 可见交互入口：`sys.interaction.current`
- 响应窗口入口：`sys.responseWindow.current`、`pendingDamage`
- 阶段推进入口：`advance-phase` / `ADVANCE_PHASE`
- 撤回入口：`UNDO_SELL_CARD` / `sys.undo`

**覆盖文件**
- `src/games/dicethrone/ai.ts`
- `src/games/dicethrone/domain/execute.ts`
- `src/games/dicethrone/domain/reducer.ts`
- `src/engine/systems/InteractionSystem.ts`
- `src/engine/systems/FlowSystem.ts`
- `src/engine/systems/ResponseWindowSystem.ts`
- `src/engine/systems/UndoSystem.ts`
- `src/engine/transport/onlineAiRecovery.ts`
- `src/engine/transport/server.ts`

## 2. 权威来源
- `.spec/knowledge/standards/testing-audit.md`
- 当前仓库源码与现有测试
- 既有证据：
  - `evidence/dicethrone/dicethrone-ai-interaction-audit-2026-04-12.md`
  - `evidence/dicethrone/dicethrone-ai-stall-audit-2026-04-11.md`
  - `evidence/engine/response-window-retrigger-system-audit-2026-04-12.md`

## 3. 结论总览
**总体结论：通过，但保留 2 个维护风险。**

- AI 对“自己可见的交互”是按优先级接管的：先 `interaction`，再 `responseWindow`，最后才是 `phase advance`。
- `CONFIRM_ROLL → RESPONSE_WINDOW_OPENED` 这条链在当前实现里是闭环的，且有去重/回退门禁。
- `UNDO_SELL_CARD` 仍保留给真人 UI，AI 侧不再生成该动作，避免卖牌↔撤回循环。

## 4. 逐项审计

### 4.1 交互链：AI 只处理自己的当前交互
**结论：✅ 通过**

**证据**
- `buildInteractionActions()` 只处理 `current.playerId === playerId` 的交互：`src/games/dicethrone/ai.ts:915-920`
- `simple-choice / compare-roll-choice / dt:card-interaction / multistep-choice` 都有对应 AI 动作生成：`src/games/dicethrone/ai.ts:922-1330`
- 空选项会走 `SYS_INTERACTION_CANCEL` 的 emergency fallback：`src/games/dicethrone/ai.ts:933-935,1086-1088,1133-1135,1155-1157,1224-1226`
- `InteractionSystem` 统一阻塞 `ADVANCE_PHASE`，避免有交互时被阶段推进绕过：`src/engine/systems/InteractionSystem.ts:1116-1120`

**判断**
- AI 可见交互链不是“看到就猜”，而是明确从 `sys.interaction.current` 取当前交互并生成对应合法动作。

### 4.2 响应窗口链：确认骰面后再开窗，改骰后会重置确认
**结论：✅ 通过**

**证据**
- `CONFIRM_ROLL` 会先产生 `ROLL_CONFIRMED`，再基于 `stateAfterConfirm` 判断是否开响应窗口：`src/games/dicethrone/domain/execute.ts:398-440`
- `DIE_MODIFIED` / `DIE_REROLLED` 在“修改者=roller”时会把 `rollConfirmed` 重置为 `false`：`src/games/dicethrone/domain/reducer.ts:669-705`
- AI 在响应窗口内只生成 `response-pass`、token 响应、`response-play-card`：`src/games/dicethrone/ai.ts:1399-1473`
- 非当前响应者若既不能直接干预，也没有 token 响应，则不出手：`src/games/dicethrone/ai.ts:1416-1418`
- `ResponseWindowSystem` 用 fingerprint 判定语义等价窗口：`src/engine/systems/ResponseWindowSystem.ts:145-157,228-233`
- watchdog 对 human responder 明确不接管：`src/engine/transport/onlineAiRecovery.ts:755-760`

**判断**
- 当前实现把“确认骰面→响应窗口→改骰→再确认”拆成了清晰的时序链，并且不会让 AI 越过当前响应者。

### 4.3 阶段推进链：只有无交互/无响应窗口时才会推进
**结论：✅ 通过**

**证据**
- AI 的阶段动作只在 `buildPhaseActions()` 里生成：`src/games/dicethrone/ai.ts:1673-1844`
- `advance-phase` 只在 `canAdvancePhase(...)` 为真时出现：`src/games/dicethrone/ai.ts:1836-1844`
- `buildDiceThroneAiLegalActions()` 的优先级是：交互 → 奖励骰 → 响应窗口 → 纯阶段动作：`src/games/dicethrone/ai.ts:1859-1893`
- `FlowSystem` 对 `ADVANCE_PHASE` 统一消费，且在 afterEvents 阶段也会做自动继续检查：`src/engine/systems/FlowSystem.ts:336-390`

**判断**
- 这条链保证 AI 不会在交互/响应窗口未收口时提前推进阶段。

### 4.4 撤回链：AI 不再生成 UNDO_SELL_CARD
**结论：✅ 通过（AI 侧关闭，真人 UI 保留）**

**证据**
- `buildPhaseActions()` 明确写死“AI 不生成 UNDO_SELL_CARD”：`src/games/dicethrone/ai.ts:1814-1818`
- 现有测试也明确断言 AI 不应生成 `UNDO_SELL_CARD`：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts:276-299`
- `UndoSystem` 仍保留撤回快照与多方批准机制：`src/engine/systems/UndoSystem.ts:179-255,408-575`
- 交互完成后 `interaction.current` 与 `responseWindow.current` 会清空，快照数保持一致：`src/games/dicethrone/__tests__/undo-after-card-give-hand.test.ts:1-106`

**判断**
- 撤回现在是“真人 UI 纠错能力”，不是 AI 的常规合法动作，因此不会再把 AI 拉进 sell↔undo 循环。

## 5. 命中维度
- **D3 数据流闭环**：`interaction → response window → phase advance → undo` 的入口、消费、回收已闭环。
- **D5 交互完整**：AI 能枚举自己当前可见交互，不会跳过当前交互直接结算。
- **D8 时序正确**：`CONFIRM_ROLL` 先落状态，再决定是否开窗；改骰会重置确认态。
- **D9 幂等与重入**：响应窗口有语义 fingerprint 去重，且 AI recovery 有稳定 tracker key。
- **D39 操作后卡住**：可见交互/响应窗口/推进阶段都有兜底路径，不是单点卡死。
- **D45 重复触发 / 重入**：重复 reopen 与重复恢复都有门禁，但仍保留少量维护风险。

## 6. 风险 / 待改进
1. **`undo-sell-card` 的残留评分枚举仍在**
   - 位置：`src/games/dicethrone/ai.ts:2698-2703,2908-2921`
   - 现状：legalActions 已不生成该动作，但评分层与历史枚举仍保留。
   - 建议：若后续彻底不打算让 AI 看到撤回类动作，可清理这组旧枚举，避免维护者误判。

2. **response-window / response-loop 的归因仍依赖 queue signature**
   - 位置：`src/engine/transport/server.ts:1242-1315,892-945`
   - 现状：同一故障若在恢复前后队列签名变化，可能拆成不同 tracker。
   - 建议：后续若新增更多响应窗口类型，统一补强 fingerprint 语义。

## 7. 验证 / 证据来源

### 7.1 静态证据
- `src/games/dicethrone/ai.ts:915-1330,1399-1893,2661-2935`
- `src/games/dicethrone/domain/execute.ts:398-440`
- `src/games/dicethrone/domain/reducer.ts:669-705`
- `src/engine/systems/InteractionSystem.ts:1116-1164`
- `src/engine/systems/FlowSystem.ts:336-390`
- `src/engine/systems/ResponseWindowSystem.ts:145-157,228-233`
- `src/engine/systems/UndoSystem.ts:179-255,408-575`
- `src/engine/transport/onlineAiRecovery.ts:740-780,892-945,1242-1315`
- `src/engine/transport/server.ts:1242-1315,892-945`

### 7.2 动态验证
- `npm run test:dicethrone -- src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- `npm run test:dicethrone -- src/games/dicethrone/__tests__/undo-after-card-give-hand.test.ts`

两条命令均返回 0。

## 8. 待改进
- 若未来要把 `undo` 重新纳入 AI 合法动作，需要同步改 `buildPhaseActions()`、策略评分、回退过滤和测试断言，避免“合法动作表”和“评分表”脱节。
- 若未来新增新的交互 kind，需要同步扩展 `buildInteractionActions()`、`resolveForceEndTurnForStalledAi()` 和 recovery fingerprint，不要让新交互掉进 emergency cancel。

---

**当前阅读说明**：本文只能证明“AI 可见交互链”当时被专项核对过，不能外推为所有隐藏交互、所有 watchdog 变体或当前 DiceThrone 整体 AI 审计都已收口。
