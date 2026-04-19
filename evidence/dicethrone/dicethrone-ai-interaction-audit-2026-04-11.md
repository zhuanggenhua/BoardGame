# DiceThrone AI 交互审计（强口径，2026-04-11 / 2026-04-12 更新）

## 审计范围
- 目标：确认 DiceThrone 中 AI 面对 **每类交互/响应/阶段动作** 都能给出合法决策，不出现卡死。
- 覆盖模块：
  - AI 决策/动作构建：`src/games/dicethrone/ai.ts`
  - 交互系统与事件系统：`src/games/dicethrone/domain/systems.ts`
  - 命令校验：`src/games/dicethrone/domain/commandValidation.ts`
  - 响应窗口系统：`src/games/dicethrone/game.ts`（ResponseWindowSystem 配置）
  - 在线 AI 兜底：`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/server.ts`

> 说明：本审计聚焦 DiceThrone AI 交互链，不覆盖其他游戏 AI。若需全仓库 AI 交互审计需另行扩展。

## 本轮强口径更新（2026-04-12）
1. 明确“强制结束失败/自动跳过失败”提示来自前端兜底（`src/pages/MatchRoom.tsx`），其含义是“兜底命令被拒绝且仍卡住”，不是单纯 UI 问题。
2. 引擎层补齐“服务端 watchdog 可在 AI seat 未建连时识别隐藏交互并兜底”的关键能力：`src/engine/transport/server.ts` 在检测到 `sys.interaction.current == null && isBlocked == true` 时，为每个 AI seat 构造 `playerView` 并传入 `resolveForceEndTurnForStalledAi`。
3. 将“自动上报携带无法选择原因/无解原因”的字段清单写入审计结论（见下文）。
4. 针对用户报告的“response-window 重触发/音效循环像 AI 不停点击”的现象，补齐两条关键防线：
   - 引擎层：watchdog 在 responseWindow 当前响应者为 human 时不应误触发强制结束（避免失败提示与误报）
   - DiceThrone AI：避免在 `rollConfirmed=true` 后继续发起“重掷骰子类被动动作”，减少重复打开响应窗口对真人的打扰
5. **AI response-window 动作增加“当前响应者门禁”**：  
   当响应窗口存在但当前响应者不是 AI 时，AI 不再生成 `RESPONSE_PASS` / `response-play-card`，避免“对手响应窗口里 AI 反复尝试无效命令”的假卡死与失败提示噪音。

> 引擎层统一结论与已知盲区见：`evidence/engine/online-ai-watchdog-strong-audit-2026-04-12.md`。

## 权威来源 / 规则依据
- DiceThrone 交互类型定义：`src/games/dicethrone/domain/core-types.ts`（InteractionDescriptor）
- 交互调度与阻塞逻辑：`src/games/dicethrone/domain/systems.ts`
- AI 构建交互动作：`src/games/dicethrone/ai.ts`
- 校验门禁：`src/games/dicethrone/domain/commandValidation.ts`
- 响应窗口门禁：`src/games/dicethrone/game.ts`（ResponseWindowSystem 允许类别）

## 交互类型 → AI 可执行性清单

> 结论口径：✅ 能生成合法动作并可推进；⚠️ 有潜在缺口/需关注；❌ 明确缺失。

### A. InteractionSystem 交互
| 交互类型 | 产生入口 | AI 动作构建 | 校验/门禁 | 结论 | 风险/备注 |
|---|---|---|---|---|---|
| `simple-choice` | InteractionSystem / Prompt | `buildInteractionActions` → `interaction-choice`（支持 multi 组合 + 可空选） | `SYS_INTERACTION_RESPOND` | ✅ | **风险**：若 `options=[]` 且 `min>0`，当前不会自动 cancel，AI 可能无可执行动作（依赖上游不产生空选）。|
| `compare-roll-choice` | 伤害对比/决斗类提示 | `interaction-choice` 或 `SYS_INTERACTION_CONFIRM` | `SYS_INTERACTION_RESPOND/CONFIRM` | ✅ | 无明确缺口 |
| `dt:card-interaction (selectPlayer)` | 卡牌选择玩家 | `interaction-select-player` → `RESOLVE_INTERACTION` | `validateResolveChoice` | ⚠️ | 若 `requiresTargetWithStatus` 但无人满足：systems.ts 会提前 resolve；**但** `resolveCustomActionId` 若只产出非状态事件，interaction 可能残留 |
| `dt:card-interaction (selectStatus)` | 选状态移除/转移 | `interaction-remove-status` / `interaction-transfer-status` | `validateRemoveStatus/validateTransferStatus` | ⚠️ | **高风险**：不可移除 status/token 仍会被视为可选；validate 放行但 execute 不产事件 → interaction 不 resolve，可能形成重复交互/卡死。 |
| `dt:card-interaction (selectTargetStatus)` | 二段转移目标选择 | `interaction-transfer-status` | `validateTransferStatus` | ✅ | 无选项时 emergency cancel |
| `multistep-choice (dtType=selectDie)` | 掷骰/选择骰子 | `interaction-multistep` → `REROLL_DIE` + confirm | `validateRerollDie` | ✅ | **风险**：若无可用骰子（异常数据），AI 无 emergency cancel（legalActions 可能为空）。|
| `multistep-choice (dtType=modifyDie)` | 修改骰子 | `interaction-multistep` → `MODIFY_DIE` + confirm | `validateModifyDie` | ✅ | 同上（极端情况下无可选骰） |

### B. ResponseWindow / Token / Bonus Dice
| 类型 | 产生入口 | AI 动作构建 | 校验/门禁 | 结论 | 风险/备注 |
|---|---|---|---|---|---|
| `responseWindow`（响应卡牌） | ResponseWindowSystem | `response-play-card` / `response-pass` | `isCardPlayableInResponseWindow` + ResponseWindow allowlist | ✅ | 若窗口残留会形成循环 → 已有清理与 watchdog 兜底；但 action-loop 仅覆盖主阶段，响应循环仍有盲区 |
| `pendingDamage token response` | `TOKEN_RESPONSE_REQUESTED` | `token-response` / `skip-token-response` | `validateUseToken` / `validateSkipTokenResponse` | ✅ | 交互阻塞由 sys.interaction `dt:token-response` 标记，AI 仍能走 response actions |
| `bonus dice reroll` | `BONUS_DICE_REROLL_REQUESTED` | `bonus-die-reroll` / `skip-bonus-dice-reroll` | `validateRerollBonusDie` / `validateSkipBonusDiceReroll` | ✅ | displayOnly 模式不创建交互，AI 无需处理 |

### C. 阶段/资源相关动作（非交互，但会卡死）
| 动作类型 | AI 构建入口 | 结论 | 风险/备注 |
|---|---|---|---|
| setup 选角/准备/开局 | `buildSetupActions` | ✅ | 已有本地/远程 AI 覆盖 |
| roll/lock/confirm/select-ability | `buildPhaseActions` | ✅ | defensiveRoll 已避免重复 select-ability 循环 |
| play-card / play-upgrade | `buildPhaseActions` | ✅ | 依赖 `isCommandValid` / card 可用性 |
| sell-card / undo-sell | `buildPhaseActions` | ✅ | **已修复循环根因**（undo-sell 去 economy 标签 + advance-phase 排除 undo-sell） |
| discard-card（弃牌阶段） | `buildPhaseActions` | ✅ | 仅 discard 阶段使用 DISCARD_CARD |
| advance-phase | `buildPhaseActions` | ✅ | 优先级受投影与策略控制；已排除 undo-sell 干扰 |
| use-passive / purify / pay-remove-knockdown | `buildPassiveActions`/`buildPurifyActions` | ✅ | 有条件门禁 |

## 在线 AI 兜底链路审计
- `onlineAiRecovery.ts` 触发条件：
  - `pending-damage`（token 响应）→ `SKIP_TOKEN_RESPONSE`
  - `visible/hidden interaction` → `SYS_INTERACTION_RESPOND/CANCEL`
  - `response-window` → `RESPONSE_PASS`
  - **新增**：`action-loop`（重复/交替动作）→ `ADVANCE_PHASE` 并上报
  - `active-turn` → `ADVANCE_PHASE`
- `server.ts`:
  - recovery 过程检测 `loop_detected` / `no_progress` / `command_failed`
  - 失败达到阈值自动上报（含 interaction/response/loop 快照）
  - 仅对 AI seat 生效（human seat 不触发 watchdog）
- **重要盲区**：
  - `action-loop` 只覆盖主阶段 `repeat/alternating`，不覆盖响应窗口循环、三步以上循环。
  - `action-loop` 依赖 `actionLog.kind` 粒度；若动作未入 log 或 kind 过粗，会漏检。
- MatchRoom 前端 4s/8s 自动恢复 **只 toast 不上报**，可能导致“已恢复但无诊断证据”。

### 强口径结论：watchdog 不会误伤真人玩家（DiceThrone 同样成立）
1) **候选 playerId 必须是 AI seat**：`resolveForceEndTurnForStalledAi()` 只对 `seatControllers[playerId].type !== 'human'` 返回候选。  
2) **服务端 watchdog 从 setupData 解析 seatControllers**：真人 seat 不会被强制推进（除非 setupData 把真人错误标记为 AI；该风险已由 `enableAi` 信任门禁约束）。  
3) **response-window 强制关闭仅在“无真人响应者且重复失败”时触发**：避免在真人参与的响应窗口中粗暴闭窗。

### 自动上报（为什么无法选择 / 为什么无解）——字段口径
服务端 watchdog 上报 `stateSnapshot` 会包含（用于直接修复“无解交互/循环”根因）：
- interaction 快照（shared + seat）
- `buildInteractionSelectabilityDiagnostic(...)`：每个 option 的 disabled 线索
- `resolveUnsatisfiableReasonFromInteraction(...)` / `resolveUnsatisfiableReasonFromSelectability(...)`：无解原因
- responseWindow 快照（windowType/sourceId/responderQueue/currentResponderIndex）
- `legalActions` 摘要（AI 在当前态可执行哪些命令）
- pendingDamage（若命中）

> 注：是否真正向外 HTTP 上报取决于反馈 endpoint 配置；但快照生成逻辑本身是诊断“单一真相源”。

### 追加审计结论：response-window 重触发不应被 watchdog 误判为 AI 卡死
- 背景：当 responseWindow 当前响应者是 human 时，ResponseWindowSystem 会拒绝非当前响应者的推进命令。
  若 watchdog 仍尝试 `ADVANCE_PHASE`，会导致“强制结束失败”提示与重复失败上报，进一步干扰玩家。
- 已落地修正：`src/engine/transport/onlineAiRecovery.ts` 增加门禁：responseWindow 当前响应者为 human 时直接 `return null`。
- 静态验证：`src/engine/transport/__tests__/server.test.ts` 新增对应测试用例（见引擎审计文档）。

### 追加审计结论：DiceThrone AI 应尽量把重掷决策放在 CONFIRM_ROLL 之前（减少对真人的重复提示）
- 现象推断：AI 若在 `CONFIRM_ROLL` 后仍持续选择“重掷骰子类被动动作”，会产生多次 `RESPONSE_WINDOW_OPENED`，导致真人听到响应音效反复播放并被反复打断。
- 已落地修正：`src/games/dicethrone/ai.ts` 在 `rollConfirmed=true` 时不再产出 `rerollDie` 类型 `use-passive-ability` 动作（AI 行为层收敛，不改变真人规则）。

## D1-D49 维度结论（摘取关键维度）
| 维度 | 结论 | 证据 |
|---|---|---|
| D3 数据流闭环 | ✅ | InteractionDescriptor → systems.ts queueInteraction → ai.ts buildInteractionActions → commandValidation → execute → reducer
| D5 交互完整 | ✅ | simple-choice/compare-roll/dt:card-interaction/multistep-choice/response/token/bonus dice 全部有 AI action 入口
| D8 时序正确 | ✅ | TOKEN_RESPONSE_CLOSED 同步 resolve 交互并清理 responseWindow；bonusDice displayOnly 不阻塞
| D9 幂等与重入 | ⚠️观察 | simple-choice / multistep-choice 空选项无 emergency cancel；异常数据可能 legalActions 为空
| D14 回合清理完整 | ✅ | `TURN_CHANGED` 清理 lastSoldCardId 等临时状态
| D15 UI 状态同步 | ✅ | canUndoDiscard/phase gating 与 validate 一致
| D20 可观测性 | ⚠️观察 | 服务端反馈含“无法选择原因”，但前端自动恢复无上报；缺 AI 决策解释（legalActions/chosenAction）
| D39 流程/交互卡死 | ⚠️观察 | watchdog 覆盖 pending-damage/interaction/response-window/active-turn + action-loop，但 action-loop 有响应循环盲区

## 已验证证据（现有测试）
> 续审说明：本轮仅做静态审计与口径对齐，**未复跑任何测试**。下列为历史证据清单，非本轮新增验证。
- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`（AI action 构建覆盖）
- `src/games/dicethrone/__tests__/token-response-window.test.ts`
- `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
- E2E 证据（可选增强，非本轮硬门槛）：  
  - `evidence/dicethrone/dicethrone-ai-stall-fixes-e2e-test.md`（响应窗口循环、main2 卡死、弃牌超限、卖/撤循环）  
  - `evidence/dicethrone/dicethrone-discard-undo-loop-e2e-test.md`

## 未覆盖风险 / 待补项
1. **不可移除 status/token 仍可被选中**：validate 放行但 execute 不产事件，interaction 不 resolve → 重复交互/卡死。
2. **`selectPlayer + resolveCustomActionId` 未统一显式 resolve**：handler 若只产出非状态事件，interaction 可能残留。
3. `simple-choice` 在 **无可选项 + min>0** 的异常情况下，AI 没有自动 cancel（需依赖上游不生成空选）。
4. `multistep-choice` 若出现 **无可用骰子** 的异常数据，AI 没有 emergency cancel。
5. `dt:card-interaction` 新增类型若未同步 `ai.ts`，AI 会直接无动作。
6. `action-loop` 只覆盖 repeat/alternating，未覆盖响应循环/三步循环；且依赖 actionLog.kind。
7. MatchRoom 前端自动恢复只 toast 不上报；feedback 缺 AI 决策解释（legalActions/chosenAction/reasoningSummary）。
8. 若需要“全仓库 AI 交互审计”（非 DiceThrone），需追加其他游戏与 engine/ai 的专项审计。
9. **经济动作循环盲区**：`SELL_CARD / DISCARD_CARD / UNDO_SELL_CARD` 不在 ActionLog allowlist 时，action-loop detector 很可能完全看不到这类循环（需依赖独立动作轨迹或扩充日志源）。
10. **response-window reopen 边界**：rollConfirmed 被重置后再次确认导致的 reopen 条件需与专项审计一致（见 `dicethrone-response-window-retrigger-audit-2026-04-12.md` 的未覆盖项）。

## 建议（不强制变更）
- 为 `simple-choice` 和 `multistep-choice` 添加“无选项 emergency cancel”兜底，避免异常状态下 AI 无动作可选。
- 对 `selectStatus`/`transferStatus` 增加 **removable 过滤** 或在 validate 中阻断不可移除状态。
- 为 `selectPlayer + resolveCustomActionId` 增加统一 `resolveInteraction()` 语义，避免依赖后续事件类型。
- 补 action-loop 专项测试（repeat/alternating）与响应循环检测。
- 追加一条 AI E2E：`main2 仅剩 undo-sell 时应直接推进阶段`（已写入但待重跑）。

## 修订记录
- 2026-04-11：新增 action-loop 兜底与 AI sell/undo 循环根因修复，补审计。
- 2026-04-12：补齐“服务端 watchdog 可处理隐藏交互阻塞（AI seat 未建连也可兜底）”的引擎级关键能力，并把失败提示含义/自动上报字段口径写入强口径审计。
- 2026-04-12（追加）：修正 watchdog 在 human 响应窗口误触发的风险；并约束 DiceThrone AI 避免在已确认骰面后反复重掷导致 response-window 重触发打扰真人。
