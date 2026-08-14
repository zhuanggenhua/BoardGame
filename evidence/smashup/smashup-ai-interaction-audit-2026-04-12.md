# Smash Up AI 交互审计（2026-04-12）

## 审计范围

本轮仅做**静态全链路审计**，不改代码、不跑测试，聚焦会导致 AI 卡死/重复交互/响应窗口失控的链路：

- AI 动作生成：`src/games/smashup/ai.ts`
- 游戏系统编排：`src/games/smashup/game.ts`
- 计分/自动推进/流程阻塞：`src/games/smashup/domain/index.ts`
- 交互桥接系统：`src/games/smashup/domain/systems.ts`
- 同时触发排序：`src/games/smashup/domain/reactionQueue.ts`、`src/games/smashup/domain/reactionQueueHandlers.ts`
- destroy→move 后处理去重：`src/games/smashup/domain/reducer.ts`
- 引擎 pipeline / 交互取消语义：`src/engine/pipeline.ts`、`src/engine/systems/InteractionSystem.ts`、`src/engine/systems/SimpleChoiceSystem.ts`
- 既有覆盖线索（本轮未重跑）：
  - `src/games/smashup/__tests__/promptSystem.test.ts`
  - `src/games/smashup/__tests__/reactionQueueOrdering.test.ts`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - `src/games/smashup/__tests__/meFirst.test.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `evidence/smashup/smashup-online-ai-timeout-recovery-e2e-test.md`
  - `docs/bugs/smashup/smashup-igor-fix-summary.md`

## 权威来源

1. `.spec/knowledge/standards/testing-audit.md`
2. `docs/bugs/smashup/smashup-igor-fix-summary.md`
3. `evidence/smashup/smashup-online-ai-timeout-recovery-e2e-test.md`
4. 上述源码与测试文件

## 选择的审计维度与理由

- **D8 时序正确**：AI 卡死、响应窗口与交互链错序、交互后不恢复流程都属于核心时序问题。
- **D9 幂等与重入**：重复弹窗、重复触发、弃牌/撤回循环、反复响应都与重入/重复处理直接相关。
- **D39 流程控制标志清除完整性**：`flowHalted`、计分 session、startTurn 特殊标志如果清不干净，会直接导致“操作后卡住”。
- **D40 后处理循环事件去重完整性**：Smash Up 历史上已有 Igor 双触发教训，必须复核 destroy/move 循环去重。
- **D41 系统职责重叠检测**：交互系统、SmashUpEventSystem、`postProcessSystemEvents` 都在处理同批事件，最容易复发双重处理。
- **D45 Pipeline 多阶段调用去重**：当前 pipeline 在 4.5 和 afterEvents 轮次都会调用 `postProcessSystemEvents`，必须确认不会重复消费同一批事件。

## 结论总览

| 维度 | 结论 | 说明 |
|---|---|---|
| D8 | ⚠️ 部分通过 | AI 动作优先级和阶段推进门禁总体正确，但交互桥接链仍有重复后处理风险 |
| D9 | ⚠️ 部分通过 | 候选刷新、skip/cancel 兜底已做；但重复后处理会把幂等重新打穿 |
| D39 | ✅ 基本通过 | `flowHalted`/auto-continue 主链路大体自洽，未见明显“只看标志不看状态”的老问题回归 |
| D40 | ✅ 通过 | `processDestroyMoveCycle` 已从输入事件构建去重集合，旧 Igor 根因在 reducer 层已修正 |
| D41 | ❌ 未通过 | `SmashUpEventSystem.afterEvents()` 仍手动调用 `postProcessSystemEvents()`，与 pipeline 统一后处理职责重叠 |
| D45 | ❌ 未通过 | 同一批“交互处理器产出的领域事件”会先在系统层做一次后处理，再在 pipeline 中继续后处理 |

---

## 逐项结论

### 1. AI 动作层的正向防卡死设计（通过项）

#### 1.1 交互优先级正确，AI 不会在 prompt 还活着时先去点响应或结束阶段
- 证据：`src/games/smashup/ai.ts:1434-1442`
- 观察：`buildSmashUpAiLegalActions()` 先取 `interactionActions`，再取 `responseActions`，最后才回到普通阶段动作。
- 判定：**D8 ✅**。这能避免“响应窗口还在，但 AI 先 `response-pass` / `advance-phase` 抢跑”的明显错序。

#### 1.2 AI 不会在有交互/响应窗口/计分前 special 可激活时暴露 ADVANCE_PHASE
- 证据：`src/games/smashup/ai.ts:264-271`
- 观察：`canAdvancePhase()` 显式拦截 `sys.interaction.current`、`sys.responseWindow.current`，以及计分阶段仍有可激活 special 的场景。
- 判定：**D8 ✅ / D39 ✅**。这说明 Smash Up AI 本身不是“什么都不看就强行结束阶段”。

#### 1.3 AI 对 simple-choice 会刷新候选，并有空选择/紧急取消兜底
- 证据：`src/games/smashup/ai.ts:899-946`
- 观察：
  - 先用 `getFreshSimpleChoiceOptions()` 刷新候选；
  - `min=0` 时会生成空选择；
  - 无有效候选时会生成 `SYS_INTERACTION_CANCEL` 的 emergency-cancel。
- 判定：**D9 ✅（动作生成层）**。AI 侧不是完全裸奔，已有“过期候选”和“无选项”兜底。

#### 1.4 响应窗口系统配置与 AI 语义一致
- 证据：`src/games/smashup/game.ts:57-72`
- 观察：
  - `loopUntilAllPass: true`
  - `interactionLock.requestEvent = 'SYS_INTERACTION_REQUESTED'`
  - `hasRespondableContent()` 会按 `meFirst/afterScoring` 重新检查手牌是否真有可响应内容
- 判定：**D8 ✅ / D39 ✅**。配置上是在防“窗口还在但其实没人能响应”的死锁。

### 2. D39：流程控制标志清除主链路（基本通过）

#### 2.1 scoreBases 的 halt 清理条件已经和交互/响应窗口绑定
- 证据：`src/games/smashup/domain/index.ts:1213-1236`
- 观察：`flowHalted` 时若 `interaction.current` 仍存在就继续 halt；只有交互已经没了，才会清 `flowHalted=false`。
- 判定：**D39 ✅**。这符合“看背后状态，不只看标志”的规范。

#### 2.2 auto-continue 不会在交互/响应窗口仍存在时乱推进
- 证据：`src/games/smashup/domain/index.ts:1589-1644`
- 观察：
  - 任意阶段只要 `interaction.current` 存在就不 auto-continue；
  - `scoreBases` 下只要 `responseWindow.current` 存在也不 auto-continue；
  - 仅在 `flowHalted && !interaction && !responseWindow` 时恢复推进。
- 判定：**D39 ✅ / D8 ✅**。老式“交互结束后还永久 halt”路径目前静态上看已经被修过。

#### 2.3 但存在一个未落地的死代码标志
- 证据：全文搜索 `_waitForPostScoringReduce` 仅命中 `src/games/smashup/domain/index.ts:1634`
- 观察：这个标志只读不写，说明当前流程控制里仍有未完成/遗留分支。
- 判定：**D39 ⚠️ 技术债**。它不是已确认 bug，但说明 scoreBases 流控仍有“计划中的保护分支没有真正接线”。

### 3. D40：destroy→move 循环去重（通过）

#### 3.1 destroy 去重集合已经从输入事件构建
- 证据：`src/games/smashup/domain/reducer.ts:1467-1538`
- 观察：
  - 第一轮直接遍历 `currentEvents` 建 `processedDestroyUids`；
  - 后续只对未进集合的新 `MINION_DESTROYED` 再跑 destroy 触发；
  - 不再依赖 `afterDestroy.events` 反推“已处理输入”。
- 判定：**D40 ✅**。Igor 老问题的 reducer 级根因目前是修过的。

### 4. D41 / D45：系统职责重叠与 pipeline 双处理（核心失败项）

#### 4.1 交互桥接系统仍在手动调用 `postProcessSystemEvents`
- 证据：`src/games/smashup/domain/systems.ts:319-329`
- 观察：当 `SYS_INTERACTION_RESOLVED` 命中 handler 后，`createSmashUpEventSystem.afterEvents()` 会对 `emittedEvents` 立即执行一次 `postProcessSystemEvents()`。
- 判定：**D41 ❌ / D45 ❌**。

#### 4.2 pipeline 本身也会对同一批领域事件继续调用 `postProcessSystemEvents`
- 证据：
  - `src/engine/pipeline.ts:667-705`（命令执行后的 4.5）
  - `src/engine/pipeline.ts:364-390`（afterEvents rounds）
- 观察：pipeline 已经把 `domain.postProcessSystemEvents` 作为统一后处理入口；afterEvents 产出的 `roundEvents` 进入 pipeline 后仍会再走一次。
- 判定：**D41 ❌ / D45 ❌**。这与 `docs/bugs/smashup/smashup-igor-fix-summary.md` 里“SmashUpEventSystem 不应再手动后处理”的口径相冲突。

#### 4.3 为什么这对 AI 尤其危险
- 证据链：
  - AI 的隐藏交互/自动决策主要走 `SYS_INTERACTION_RESOLVED` → `SmashUpEventSystem.afterEvents()` → handler；
  - 也就是说，**AI 最常走的链路正好就是当前重叠职责链路**。
- 风险：
  - 同一批 `MINION_DESTROYED`/`ACTION_PLAYED`/trigger queue 事件可能先被系统层处理一次，再被 pipeline 统一入口处理一次；
  - 即使部分去重集合能挡住 `MINION_PLAYED`/`ACTION_PLAYED`，destroy/affect/deck-inspection/reaction-queue 仍可能被重复推进；
  - 这正是“AI 响应后立刻又触发一遍”“弹窗/提示音反复出现”“跳过后立刻再开一次交互”的结构性土壤。
- 判定：**高优先级结构性 finding**。

#### 4.4 该问题与历史结论自相矛盾
- 证据：`docs/bugs/smashup/smashup-igor-fix-summary.md`
- 观察：文档明确写过“已采用方案 A：移除 SmashUpEventSystem 的后处理”；但当前 `systems.ts` 实际仍保留 `postProcessSystemEvents()` 调用。
- 判定：**D41 ❌ / D43 ⚠️（顺带命中）**。这不是单纯文档过期，而是“历史已裁决的职责边界”与现状代码不一致。

### 5. CANCELLED / emergency-cancel 路径存在未消费风险（中优先级 finding）

#### 5.1 AI 的无选项兜底会发 `SYS_INTERACTION_CANCEL`
- 证据：`src/games/smashup/ai.ts:928-946`
- 观察：当 `options.length === 0` 或小于 `minCount` 时，Smash Up AI 直接生成 `interaction-cancel`，命令是 `SYS_INTERACTION_CANCEL`。

#### 5.2 引擎会把取消交互转换成 `SYS_INTERACTION_CANCELLED`
- 证据：`src/engine/systems/InteractionSystem.ts:1193-1200`
- 观察：取消当前交互会 resolve 当前 prompt，并发出 `INTERACTION_EVENTS.CANCELLED`。

#### 5.3 但 Smash Up 域内只消费 `RESOLVED`，没有消费 `CANCELLED`
- 证据：
  - `src/games/smashup/domain/systems.ts:255-330` 只分支处理 `INTERACTION_EVENTS.RESOLVED`
  - 全文搜索 `src/games/smashup` 未命中 `INTERACTION_EVENTS.CANCELLED` / `SYS_INTERACTION_CANCELLED`
- 观察：这意味着 emergency-cancel 能把 prompt 关掉，但**不会触发 source-specific cleanup / skip branch / 补偿事件**。
- 风险：
  - 若某个交互本应在 skip/cancel 时补发恢复事件，AI 的 emergency-cancel 只会“关窗”，不会“善后”；
  - 当前仓库里 `promptSystem.test.ts` 只验证“能生成 cancel action”，**没有覆盖 cancel 后流程是否完整恢复**。
- 判定：**D8 ⚠️ / D39 ⚠️ / D3 ⚠️**。这是直接关联 AI 兜底的未闭环点。

### 6. reaction queue 与多交互链本身设计基本健康（通过项）

#### 6.1 同时触发排序会显式落到 interaction，而不是隐式自动乱跑
- 证据：`src/games/smashup/domain/reactionQueue.ts:192-217`
- 观察：
  - 若已有 `interaction.current`，reaction queue 不会抢着再插入；
  - 多个 trigger 同时存在时，会生成 `reaction_queue_choose_next` 的 simple-choice；
  - 选项附带 `_ai` hint。
- 判定：**D8 ✅ / D9 ✅**。这是正确的“显式排序 prompt”路线，不是隐藏 if/else 自动乱选。

#### 6.2 仓库内已有较多 AI/交互回归覆盖线索，但本轮未重跑
- 现有覆盖线索（仅引用，不代表本轮动态验证）：
  - `reactionQueueOrdering.test.ts`：同时触发排序 + AI hint
  - `scoreBases-auto-continue.test.ts`：stale option、reaction queue、responseWindow 穿插多段交互
  - `meFirst.test.ts`：response window 内带 interaction 的 special 及 skip 分支
  - `smashup.smoke.test.ts`：高压响应窗口 vs response-pass 决策
  - `evidence/smashup/smashup-online-ai-timeout-recovery-e2e-test.md`：隐藏 AI 交互超时自动收口
- 判定：**现有测试面不算薄，但仍未覆盖本轮发现的 CANCELLED 善后缺口，也无法替代对 D41/D45 结构冲突的修复。**

---

## 问题清单（按优先级）

### P1（必须优先处理）

#### Finding 1：交互桥接系统与 pipeline 统一后处理职责重叠
- 文件：
  - `src/games/smashup/domain/systems.ts:319-329`
  - `src/engine/pipeline.ts:364-390`
  - `src/engine/pipeline.ts:667-705`
  - `src/games/smashup/domain/index.ts:1885-2179`
- 影响：
  - 交互解决后重复触发后处理；
  - 容易再现“重复交互/重复响应/重复提示音/跳过后又弹一次”；
  - AI 因为更多依赖隐藏 interaction，更容易踩中。
- 建议：
  - 回到 Igor 修复口径：**SmashUpEventSystem 只做“交互 resolved → 原始领域事件”桥接，不在系统里再次跑 `postProcessSystemEvents()`**；
  - 统一把后处理权威入口收敛到 pipeline。

### P2（中高优先级）

#### Finding 2：AI emergency-cancel 没有 Smash Up 域内善后消费链
- 文件：
  - `src/games/smashup/ai.ts:928-946`
  - `src/engine/systems/InteractionSystem.ts:1193-1200`
  - `src/games/smashup/domain/systems.ts:255-330`
- 影响：
  - AI 在“空候选/过期候选”场景下虽然能把交互关掉，但 source-specific cancel/skip cleanup 不一定会执行；
  - 若交互依赖取消时补偿事件，可能留下流程残态。
- 建议：
  - 要么在 SmashUp 域内补 `INTERACTION_EVENTS.CANCELLED` 消费；
  - 要么把 AI 的空候选兜底统一改成**语义化 skip option**，避免 domain 完全收不到善后信号。

### P3（技术债）

#### Finding 3：`_waitForPostScoringReduce` 是只读不写的死标志
- 文件：`src/games/smashup/domain/index.ts:1634`
- 影响：
  - 当前不一定直接出 bug；
  - 但说明 scoreBases 流控里还有未完成的保护方案，未来继续补丁时容易造成误判。
- 建议：
  - 要么补齐真正写入/清除链；
  - 要么删除死分支，避免给后续排障制造假线索。

---

## 与“AI 卡死”直接相关的裁决

### 已确认不是 Smash Up 当前主因的点
- AI 动作生成层**不是**完全没有兜底：有候选刷新、空选择、response-pass、advance-phase 门禁。
- `flowHalted` 主链路**不是**明显老式坏状态：静态上看已与 `interaction` / `responseWindow` 绑定。
- destroy/move 循环**不是**沿用旧版 D40 根因：去重逻辑已修正。

### 当前最像“AI 反复交互 / 反复响应 / 隐藏 prompt 卡住”的结构性根因
1. **系统层 + pipeline 双后处理仍并存**（P1）
2. **AI emergency-cancel 没有域内善后闭环**（P2）

这两条都不是“单个卡牌 AI 权重不对”的问题，而是**底层交互处理职责边界还不够干净**。

---

## 本轮未覆盖风险

1. **未动态重跑测试/E2E**：本轮只做静态审计，因此不能替代真正的回归验证。
2. **未逐张卡牌穷举 sourceId→handler cancel 语义**：只确认了“resolved 有桥、cancel 没桥”的结构事实，没逐张盘点哪些卡会因此漏善后。
3. **未审计 UI 声音/提示层去重**：若提示音重复还有前端 EventStream 消费层问题，本轮未继续展开。

## 建议给主线任务的下一步

1. **先修 P1：移除/收敛 `systems.ts` 里的手动 `postProcessSystemEvents()`**。
2. **再补 P2：给 Smash Up 加上 `INTERACTION_EVENTS.CANCELLED` 善后链或统一 skip 语义**。
3. 修完后优先回归：
   - `scoreBases-auto-continue.test.ts`
   - `meFirst.test.ts`
   - `reactionQueueOrdering.test.ts`
   - 与隐藏 AI 交互相关的 Smash Up E2E（复用已有 timeout recovery 场景）

## 修订记录

- 2026-04-12：首次形成《Smash Up AI 交互审计》；结论为**存在 2 个直接影响 AI 卡死/重复交互的结构性 finding（P1/P2）**，不可视为“已收口”。
- 2026-04-12：已修复 P1（移除 `SmashUpEventSystem.afterEvents()` 内部对 `postProcessSystemEvents()` 的重复调用），并回归：
  - `npm run test -- src/games/smashup/__tests__/architecture-duplicate-processing.test.ts`
  - `npm run test -- src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts`
  当前**仅确认 P1 结构性重复后处理已移除**，P2（CANCELLED 善后链）仍待处理。
- 2026-04-12：已修复 P2（在 `SmashUpEventSystem.afterEvents()` 中处理 `INTERACTION_EVENTS.CANCELLED`；优先复用交互里的控制选项值，缺失时再归一化为 `skip/__cancel__/__emergency_skip__`，让 handler 与 deferred post-scoring 善后链继续落地），新增/复跑回归：
  - `npm run test -- src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`（新增用例：`base_greenhouse 被 watchdog emergency-cancel 时，仍应补发延迟清场而不是卡在 afterScoring`）
  - `npm run test -- src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `npm run test -- src/games/smashup/__tests__/architecture-duplicate-processing.test.ts src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts`
