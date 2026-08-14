# 王权骰铸 AI 卡死/无解交互历史专项审计（2026-04-10）

> 2026-06-06 当前有效口径：本文只记录 2026-04-10 那轮“无解交互/emergency skip/卡死”专项审计与当时修复口径，不是当前 DiceThrone AI 全链路、也不是当前新英雄补审的完成证明。阅读时只能把它当作历史专项审计证据；当前在线 AI 与新英雄的真实状态应以更晚的主审计文档和现行代码/测试为准。

## 1. 审计范围
- **模块范围**：交互系统（InteractionSystem + SimpleChoiceSystem）与 DiceThrone 领域事件系统（`src/games/dicethrone/domain/systems.ts`）。
- **问题范围**：AI/玩家遇到“无可选项”的交互导致回合无法推进（卡死）。
- **核心链路**：`CHOICE_REQUESTED → InteractionSystem(simple-choice) → SYS_INTERACTION_RESPOND → SYS_INTERACTION_CANCELLED → DiceThroneEventSystem → flowHooks/advancePhase`。

## 2. 权威来源
- 项目交互/审计规范：`.spec/knowledge/standards/testing-audit.md`
- DiceThrone 领域实现：
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/choiceEffects.ts`
- 引擎交互实现：
  - `src/engine/systems/InteractionSystem.ts`
  - `src/engine/systems/SimpleChoiceSystem.ts`

## 3. 审计维度与结论（✅/❌）
### D5 交互完整
✅ **新增兜底**：InteractionSystem 在 options 为空/全 disabled/min 不可达时自动注入 `__emergency_skip__`，确保交互可结束，不再“无解即卡死”。

❌ **领域收口缺失**：DiceThrone 在收到 **emergency skip** 时仅生成 `INTERACTION_CANCELLED` 领域事件，并未清理 `pendingAttack`/`targetingSelectionPending`，导致“交互取消但流程仍 halt”。

### D8 时序正确
❌ **阻塞未释放**：目标选择类交互被取消后，`flowHooks` 仍认为 `pendingAttack` 未完成，从而持续 halt，无法自动推进到下一阶段。

✅ **补救修复**：在 `DiceThroneEventSystem` 的 `SYS_INTERACTION_CANCELLED` 分支增加 emergency skip 专用兜底，确保无解选择可清理 pending 状态并恢复流程推进。

### D9 幂等与重入
❌ **响应窗口重复触发**：afterAttackResolved 响应窗口在 `RESPONSE_PASS` 关闭后，autoContinue 重入 `onPhaseExit`，再次生成 `RESPONSE_WINDOW_OPENED`，导致“跳过后立刻又弹”循环。

✅ **补救修复**：新增攻击结算序号与响应窗口处理序号，确保每次攻击仅触发一次 afterAttackResolved 响应窗口。

### D3 数据流闭环
✅ **反馈链路已闭环**：无解交互会在服务器侧自动上报，并携带交互快照（含可选项与可选性诊断），用于定位“为什么无法选择”。

### D39 流程控制标志
❌ **无解交互导致流程标志残留**：`pendingAttack` 未清理时，`ADVANCE_PHASE` 被持续阻断。

✅ **兜底修复**：emergency skip 场景下主动清理 `pendingAttack`（必要时也清理 `pendingBonusDiceSettlement`），避免流程标志残留。

## 4. 关键发现与修复
### 发现 1：targetingRoll 无可选目标时卡死
- **原因**：`getTargetingRollChoiceOptions()` 可能产出空列表（无可选对手时），导致 `CHOICE_REQUESTED` 交互无解。
- **后果**：交互被 emergency skip 取消后，`pendingAttack` 仍残留，流程不再推进。
- **修复**：在 `DiceThroneEventSystem` 中对 emergency skip 做兜底清理：
  - 若 `sourceId === 'targeting-roll'` 或选项全为 `select-target:*`，则 **清理 `pendingAttack` 与 `pendingBonusDiceSettlement`**。

### 发现 2：offensiveRollEnd Token 选择的兜底
- **原因**：理论上不会无解，但若出现“全 disabled”异常状态，流程会重复进入该交互。
- **修复**：emergency skip 时若识别为“Token 选择”（选项含 `use-*` + `skip`），则 **标记 `offensiveRollEndTokenResolved = true`**，防止重复弹窗。

### 发现 3：dt:card-interaction 无可选目标时，AI 监护会因交互锁定而误判失败
- **原因**：在线 AI 监护仅识别 simple-choice 的无解状态，遇到 `dt:card-interaction`（状态选择类）时，只会尝试 `RESPONSE_PASS`，但响应窗口被交互锁定，导致 `RESPONSE_PASS` 被拒绝 → “强制结束失败”。
- **修复**：
  - 在线 AI 监护扩展识别 `dt:card-interaction` 的 **无可选目标** 情况（如 `selectStatus` 且目标玩家均无状态/Token）。
  - 无可选时自动下发 `SYS_INTERACTION_CANCEL`，并携带 `reason=empty-options`，保证交互被取消并触发解锁推进。

### 发现 4：afterAttackResolved 响应窗口跳过后重复弹出
- **原因**：攻击结算后的响应窗口由 `flowHooks.checkAfterAttackResponseWindow` 生成，但核心状态没有“已处理”标记；`RESPONSE_PASS` 关闭后 autoContinue 重入 `onPhaseExit`，再次生成同类窗口。
- **后果**：真人响应“跳过”后立即再次触发响应窗口，形成循环卡死。
- **修复**：
  - 引入 `attackResolvedSequence`（ATTACK_RESOLVED 自增）与 `afterAttackResponseWindowSequence`（记录已处理序号）。
  - `checkAfterAttackResponseWindow` 在序号一致时直接跳过，避免重复弹窗。
  - `RESPONSE_WINDOW_OPENED(windowType=afterAttackResolved)` 时记录序号。

## 5. 验证证据
- **单测（定向）**
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/flow.test.ts --testNamePattern "targetingRoll 无可选目标时 emergency skip 会清理 pendingAttack"`
  - 结果：✅ 通过（仅跑此用例）
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/engine/transport/__tests__/server.test.ts --testNamePattern "online AI watchdog 应能识别 dt:card-interaction 无可选目标并携带 reason 取消交互"`
  - 结果：✅ 通过（仅跑此用例）

## 6. 未覆盖风险
- 其他 `CHOICE_REQUESTED` 来源若出现“空选项/全 disabled”，仍可能需要 **领域级兜底逻辑**（目前仅覆盖 targetingRoll + offensiveRollEnd）。
- 若未来新增“必须选择”的交互类型，需要同步补充 emergency skip 的 **语义回填**（例如自动选择默认目标或强制终止该动作）。
- `dt:card-interaction` 的“无解”判定仍是基于当前 core 状态的轻量检查；若交互语义更复杂（需要多条件组合），可能仍需补充更精细的判定逻辑。

## 7. 修订记录
- 2026-04-10：新增 emergency skip 领域兜底，避免 targetingRoll 无解卡死；新增对应单测。
- 2026-04-11：在线 AI 监护识别 `dt:card-interaction` 无可选目标并自动取消，避免交互锁定导致“强制结束失败”。
- 2026-04-11：afterAttackResolved 响应窗口去重（攻击序号标记 + 新增单测），修复“跳过后重复弹窗”。

## 8. CHOICE_REQUESTED 生成点审计（补充）
**结论**：除 targetingRoll 边缘场景外，其余生成点均显式保证 options 非空，且多数包含 skip 选项，不会产生“无解交互”。  

### 8.1 flowHooks
- **offensiveRollEndToken**：
  - 仅在 `offensiveRollEndTokens.length > 0` 时生成。
  - options = 可用 token + skip（恒 ≥2）。
  - ✅ 无空选项风险。
- **targetingRoll**：
  - options = `getTargetingRollChoiceOptions`，极端情况下可能为空（无对手）。
  - ✅ 已通过 emergency skip + 领域兜底清理 pendingAttack。

### 8.2 customActions
- **monk**：固定 2 选项（太极/净化、花开见佛等）或条件满足才生成。
- **pyromancer**：slider 模式固定 confirm + skip。
- **gunslinger**：决斗胜利时固定 2 选项。
> ✅ 均无空选项风险。

### 8.3 effects.ts
- `action.choice`：仅当 `choiceOptions.length > 0` 才生成事件（有门控）。
- `triggerChoice`：当前**未做空数组门禁**，依赖调用方保证 options 非空。
> ✅ `action.choice` 有门控；⚠️ `triggerChoice` 需要调用方自检或补门禁。

### 8.4 结论
- targetingRoll 仍是唯一已知会产出空 options 的入口（已兜底修复）。
- `triggerChoice` 分支目前缺少空数组门禁，若调用方传空 options 会触发无解交互，需要补门禁或兜底。
- 后续新增 CHOICE_REQUESTED 必须遵守“非空门控 + skip 或 emergency fallback”。

---

**当前阅读说明**：本文只能证明“无解交互导致卡死”这条历史专项链路曾被审计并补过兜底，不能外推为当前所有 AI 卡死、所有交互类型或 DiceThrone 整体审计都已收口。
