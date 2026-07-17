# Summoner Wars AI 交互静态审计（2026-04-12）

## 审计范围
- `src/games/summonerwars/game.ts`
- `src/games/summonerwars/ai.ts`
- `src/games/summonerwars/domain/index.ts`
- `src/games/summonerwars/domain/flowHooks.ts`
- `src/games/summonerwars/domain/abilityResolver.ts`
- `src/games/summonerwars/domain/customActionHandlers.ts`
- `src/games/summonerwars/domain/execute.ts`
- `src/games/summonerwars/domain/events.ts`
- `src/games/summonerwars/domain/types.ts`
- `src/games/summonerwars/ui/useGameEvents.ts`
- `src/games/summonerwars/ui/useCellInteraction.ts`
- `src/games/summonerwars/ui/useEventCardModes.ts`
- `docs/ai-rules/testing-audit.md`

## 权威来源
1. 当前仓库实现（以上源码文件）
2. 审计规范：`docs/ai-rules/testing-audit.md`

## 审计方法与限制
- 本轮包含**静态代码审计 + Phase A/B 迁移落地 + 验证**。
- **已改代码并补跑测试**（详见“验证说明”），未创建/切换分支。
- 重点按 D8 / D9 / D39 / D40 / D41 / D45 评估“AI 是否能看见等待态、是否会重入循环、是否可能卡死”。

## 2026-04-12 迁移补记（Phase A：仅 AI 关键链路）
> 说明：以下为**迁移后补记**，不覆盖上文静态审计结论；用于记录本轮“本地 UI 交互 → InteractionSystem”的实装进度与证据。  
> 补充：**Phase B（事件卡交互）本轮已推进并纳入验收口径**。

### 已迁移到 InteractionSystem 的 6 条交互
- SUMMON_FROM_DISCARD_REQUESTED（infection）
- GRAB_FOLLOW_REQUESTED（grab follow）
- SOUL_TRANSFER_REQUESTED
- MIND_CAPTURE_REQUESTED
- ABILITY_TRIGGERED: ice_shards_damage
- ABILITY_TRIGGERED: feed_beast_check

### Phase B：事件卡交互（已推进 / 纳入验收）
- 事件卡多步骤链路已纳入本轮**服务端交互范围**；验证以**人工 E2E + 管线单测**为主，并补充本地 AI 单测（端到端 AI 用例仍缺）。
- 代表性 E2E 仅覆盖 `bloodSummon` / `annihilate` 两条链路，其余事件卡仍是静态审计为主。
- 已补齐 UI 侧与 `sys.interaction.options` 的合同一致性，并补跑对应 E2E 证据。

关键落点（Phase A）：
- `SW_EVENTS.*_REQUESTED` → `domain/systems.ts` 创建交互
- `useCellInteraction` / `Board`：**Phase A 相关路径**改为 `sys.interaction` 派生 + `RESPOND/CANCEL`

### 关键实现落点（Phase A）
- `src/games/summonerwars/domain/systems.ts`：创建交互 + RESOLVED/CANCELLED 回流命令
- `src/games/summonerwars/game.ts`：挂载 `createSummonerWarsInteractionSystem()`
- `src/games/summonerwars/ui/useGameEvents.ts`：**Phase A 交互**改为由 sys.interaction 派生（仍保留其他本地 mode）
- `src/games/summonerwars/ui/useCellInteraction.ts` / `StatusBanners.tsx` / `Board.tsx`：交互由 sys.interaction 驱动

### 本轮修订补充（Phase A/B）
- infection：系统交互增加 skip 选项，UI 改为使用 InteractionSystem 的 `CardSelectorOverlay`（不再走本地 abilityMode 选卡路径）。
- soul_transfer / mind_capture：补齐 `interaction.data.sw` 的 `sourcePosition` 元信息，修复 banner 派生缺失。
- ice_shards：2026-07-17 已被当前用户故事覆盖为攻击阶段开始自动结算；不再生成确认/跳过交互，不再保留 skip。当前证据见 `evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`。
- HandArea busy 判定统一：引入 `useIsInteractionBusy` 与本地 mode 合并，避免系统交互时手牌仍可点。
- 事件卡终点合同统一：`stun` / `goblin_sneak` / `glacial_shift` 终点坐标统一写入 `sys.interaction.options[].value.targetPosition`，UI 不再解析 `pos:r,c` 或本地重算。
- 血契召唤：高亮/候选读取 `sys.interaction.options`，入口仍保留本地预检 + 服务端 validate 双轨；补齐收口 E2E 断言与证据。
- 除灭：多目标/伤害阶段高亮与点击改为读取 `sys.interaction.options`，确认阶段反查 `optionIds` 提交。
- 本地 AI 单测：新增 `blood_summon` 事件卡交互链自动收口用例（interaction-chain-comprehensive.test.ts），作为 AI 动态证据补点。

### 验证说明（本轮已跑）
- `npm run test:e2e:ci -- e2e/summonerwars/summonerwars-ice-shards-minimal.e2e.ts`（通过）
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/flow.test.ts --configLoader native`（通过）
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native`（通过）
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native`（通过，含本地 AI 血契召唤链路覆盖）
- `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：除灭多目标选择流程"`（通过）
- `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：血契召唤收口流程"`（通过）
- E2E 证据：`evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`
- E2E 证据：`evidence/summonerwars/summonerwars-event-annihilate-e2e-test.md`
- E2E 证据：`evidence/summonerwars/summonerwars-blood-summon-e2e-test.md`

### 仍保留的本地 UI 模式（未迁移范围）
- rapid_fire / withdraw / afterMove 系列 / magic 阶段二选一 等仍为本地 mode
- 这些仍属于“AI 看不见”的结构性风险，需要后续继续迁移

## 结论摘要

### 总裁决
**Summoner Wars 当前最核心的问题，不是 response-window 真正重开，而是“仍有关键等待态停留在本地 UI mode，而不是服务端 `sys.interaction`/`sys.responseWindow`”。本轮已确保 Phase A 六条 AI 关键交互 + Phase B 事件卡多步进入 InteractionSystem；Phase B 验证为人工 E2E + 管线单测，并补充本地 AI 单测（AI 端到端证据仍缺失），且仍有少量本地 mode 残留待迁移。**

这会直接带来三类风险：
1. **AI 看不见交互**：仍有部分链路只发 EventStream 通知，AI 无法在 `ai.ts` 里生成后续合法动作。
2. **自动反馈无法携带精确“为什么不能选”**：对仍留在本地 mode 的链路，服务端没有 options/disabled reason 可读，只剩 UI 本地 toast/本地 mode。
3. **重复事件会重建本地提示并重复响音效**：请求事件和 `ABILITY_TRIGGERED` 都被配置成 immediate 音效，重复发事件就会重复提示、重复响。

### 这轮静态审计的关键判断
- **D8：高风险** —— 事件写入发生在服务端，但仍有等待态停留在客户端本地 state（非事件卡多步）；这部分等待态不是持久化状态机。
- **D9：高风险** —— 存在清空本地 mode 后只恢复少数 phase 技能的逻辑，其他等待链在 reset/刷新后容易丢失或重建。
- **D39：中风险** —— `flowHalted` 这条链已有一定保护，但“进入 halt / 退出 halt / 人类 skip / AI 直出命令”由不同层分别负责，所有权并不统一。
- **D40：低风险/本轮未命中** —— 当前未发现 Summoner Wars 自己存在“后处理循环从输出构建去重集合”这类典型问题。
- **D41：高风险** —— 引擎 Interaction/ResponseWindow 已挂载，但游戏真实等待态主要由 `useGameEvents`/`useCellInteraction`/`useEventCardModes` 承担，职责重叠且真相源分裂。
- **D45：低风险/本轮未命中** —— 当前未发现 Summoner Wars 存在类似 SmashUp 的 `postProcessSystemEvents` 多阶段重复调用同一后处理函数的问题。

---

## 全链路观察

### 1. 引擎层已挂系统，核心等待态已迁到 InteractionSystem，但仍有本地 mode 残留
- `src/games/summonerwars/game.ts:149-153` 挂了：
  - `createInteractionSystem()`
  - `createSimpleChoiceSystem()`
  - `createMultistepChoiceSystem()`
  - `createResponseWindowSystem()`
- `src/games/summonerwars/domain/systems.ts` 已引入 `createSimpleChoice` + `queueInteraction`，覆盖 infection / grab_follow / soul_transfer / mind_capture / ice_shards / feed_beast。
- 但 `useGameEvents` / `useCellInteraction` / `useEventCardModes` 仍有本地 mode 等待态（afterMove / withdraw / rapid_fire / magic 二选一 等）。

**结论**：本轮已覆盖 Phase A + Phase B（事件卡多步），仍存在“本地 mode 真相源”残留，需要后续继续迁移。

### 2. AI 层能处理 `sys.interaction`，仍有部分链路未喂给它
- `src/games/summonerwars/ai.ts:950-1072` 明确支持：
  - `simple-choice`
  - `multistep-choice`
  - emergency cancel / empty selection
- 但这套支持只有在 `state.sys.interaction.current` 存在时才会生效。
- 当前 Summoner Wars 事件卡与 Phase A 核心交互已进入 `sys.interaction`，但 afterMove / rapid_fire / withdraw / magic 二选一 等仍是本地链路。

**结论**：AI 基础能力在，Summoner Wars 接线不足。

### 3. Summoner Wars 没有真正的 response-window 打开源
- 审计 `src/games/summonerwars/domain`、`src/games/summonerwars/ui`、`src/games/summonerwars/Board.tsx`，未发现任何 `RESPONSE_WINDOW` / `RESPONSE_PASS` / responder queue 相关实现。
- `src/games/summonerwars/ai.ts:1716-1717` 还明确规定：如果不是当前玩家且没有活动 interaction，AI 直接返回空动作。

**结论**：Summoner Wars 里用户感知到的“响应类重复触发”，更可能是**本地交互提示/本地音效重放**，不是 Dice Throne 那种真正的 response-window reopen。

---

## 交互链可见性 / AI 可解性矩阵
> 补充说明（2026-04-12 迁移后）：infection / grab_follow / soul_transfer / mind_capture / ice_shards / feed_beast 已迁移进 `sys.interaction`；Phase B 事件卡交互已纳入本轮验收（人工 E2E 证据详见下述文档）。  
> 下表与后续“本地 UI mode”列表为**静态审计时的历史结论**，保留用于说明原始根因；迁移后的现状以“迁移补记”与最新证据为准。

| 链路 | 入口 | 服务端是否有持久等待态 | AI 当前是否能解 | 审计结论 |
| --- | --- | --- | --- | --- |
| `sys.interaction.current` | `ai.ts:950-1072` | 是 | 是 | 这条链本身没问题，但 Summoner Wars 游戏层很少真正使用。 |
| `flowHalted + ice_shards/feed_beast` | `flowHooks.ts:206-214, 292-298` + `ai.ts:1583-1689` | 是（`sys.flowHalted`） | 是 | 这是少数已做游戏层兜底的等待链。 |
| `FUNERAL_PYRE_HEAL` | `ai.ts:352-421` | 是（`activeEvents`） | 是 | 这也是已被 AI 特判覆盖的例外。 |
| `SUMMON_FROM_DISCARD_REQUESTED` → infection | `abilityResolver.ts:452-460` → `domain/systems.ts` | 是（sys.interaction） | 是 | ✅ 已迁移：交互进入 InteractionSystem，UI/AI 可见。 |
| `GRAB_FOLLOW_REQUESTED` | `execute.ts:249-263` → `domain/systems.ts` | 是（sys.interaction） | 是 | ✅ 已迁移：系统交互包含位置候选+跳过。 |
| `SOUL_TRANSFER_REQUESTED` | `customActionHandlers.ts:48-55` → `domain/systems.ts` | 是（sys.interaction） | 是 | ✅ 已迁移：确认/跳过由 sys.interaction 驱动。 |
| `MIND_CAPTURE_REQUESTED` | `customActionHandlers.ts:60-68` / `execute.ts:570-588` → `domain/systems.ts` | 是（sys.interaction） | 是 | ✅ 已迁移：控制/伤害二选一可见。 |
| `ABILITY_TRIGGERED(actionId=rapid_fire_extra_attack)` | `execute.ts:699` → `useGameEvents.ts:584-595` | 否 | 否 | 高风险，本地额外攻击确认。 |
| `ABILITY_TRIGGERED(actionId=withdraw)` | `useGameEvents.ts:597-610` | 否 | 否 | 高风险，本地先选代价再选位置。 |
| `ABILITY_TRIGGERED(afterMove:spirit_bond / ancestral_bond / structure_shift / frost_axe)` | `execute.ts:291-307` → `useGameEvents.ts:671-720` | 否 | 否 | 高风险，全部依赖本地 mode。 |
| `ABILITY_TRIGGERED(ice_ram_trigger)` | `execute.ts:993-1053` → `useGameEvents.ts:727-739` | 否 | 否 | 高风险，本地目标/推拉选择。 |
| 事件卡多步交互（`bloodSummon` / `annihilate` 已有 E2E，其余 `mindControl` / `stun` / `hypnoticLure` / `chant_*` / `glacial_shift` / `sneak` 等仍为静态审计） | `domain/systems.ts` + `useEventCardModes.ts` | — | — | ✅ Phase B 迁移完成；动态证据仅覆盖 bloodSummon/annihilate，其他待补。 |
| 魔力阶段“打出事件卡还是弃牌” | `useCellInteraction.ts:118, 868, 986-995, 1127-1139` | 否 | 否 | 中高风险，本地二选一。 |

---

## 按审计维度逐项结论

### D8 时序正确 —— **高风险**

#### 事实
1. `useGameEvents.ts:484-739` 把请求事件/`ABILITY_TRIGGERED` 直接翻译成本地 `setAbilityMode` / `setGrabFollowMode` / `setSoulTransferMode` / `setMindCaptureMode` / `setRapidFireMode` / `setWithdrawTrigger`。
2. 这些等待态没有进入 `sys.interaction.current`。
3. `useGameEvents.ts:268-309` 的“刷新恢复”只覆盖 4 个 phase 技能：
   - `illusion_copy`
   - `blood_rune_choice`
   - `ice_shards_damage`
   - `feed_beast_check`
4. infection / grab / soul_transfer / mind_capture / rapid_fire / withdraw / 大量 afterMove 技能都**不在恢复名单里**。

> 补记（已修订）：infection / grab_follow / soul_transfer / mind_capture / ice_shards / feed_beast 已迁移到 InteractionSystem，不再通过 `useGameEvents` 的本地 mode 驱动；本段仅对剩余本地 mode 仍适用。

#### 判定
- **服务端写入**的是“提示事件”。
- **客户端消费**的是“本地 mode”。
- 中间没有统一持久等待态。

这意味着：
- 一旦 UI 没接住、刷新、reset、重复推进、共享 watchdog 介入，等待链就可能**丢失**或**被再次重建**。
- 这类问题不是单个 ability 的小 bug，而是**写入-消费窗口分裂**。

#### 对 AI / 自动反馈的影响
- AI 无法直接知道“当前必须选什么”。
- 自动反馈也无法从服务端状态携带“为什么不能选”，因为没有服务端 options/disabled reason 结构。

**D8 裁决：❌ 未满足统一时序要求。**

---

### D9 幂等与重入 —— **高风险**

#### 事实
1. `useGameEvents.ts:334-350` 在 `didReset` 时会清空：
   - `abilityMode`
   - `soulTransferMode`
   - `mindCaptureMode`
   - `afterAttackAbilityMode`
   - `rapidFireMode`
   - `withdrawTrigger`
   - `grabFollowMode`
2. 但 `useGameEvents.ts:268-309` 的恢复只恢复前述 4 个 phase 技能。
3. 请求事件 payload（如 `SUMMON_FROM_DISCARD_REQUESTED`、`SOUL_TRANSFER_REQUESTED`、`MIND_CAPTURE_REQUESTED`、`GRAB_FOLLOW_REQUESTED`）没有统一的 `requestId` / `interactionId`。
4. `src/games/summonerwars/domain/events.ts:85,103-106` 把 `ABILITY_TRIGGERED` 和各类 request 事件都配置成 `audio: 'immediate'`。

#### 判定
- 对同一个请求，当前系统缺少“跨 reset / 跨重复事件”的稳定去重键。
- 一旦同类事件重复出现，UI 会再次建 mode，音效也会再次播。
- 已有的一次性 `hasRecoveredRef` 只能防“首次挂载历史回放”，防不了“领域层真的又发了一次同类事件”。

#### 正面项
- `ai.ts` 中未发现 `UNDO` / `undo` 指令生成；Summoner Wars AI 本身不会制造“AI 自己反复撤回”的循环。

**D9 裁决：❌ 本地请求链缺少稳定幂等边界。**

---

### D39 流程控制标志清除完整性 —— **中风险**

#### 事实
1. `flowHooks.ts:206-214`：phase-end 技能会在需要确认时返回 `halt: true`。
2. `flowHooks.ts:292-298`：`onAutoContinueCheck` 会在 `flowHalted` 且不再需要确认时自动推进。
3. `ai.ts:1583-1689`：AI 对 `flowHalted + ice_shards/feed_beast` 有专门动作生成。
4. 但人类 UI 的 skip / cancel 又部分落在组件层：
   - `Board.tsx:528-547` 的 `handleCancelAbility` 对 `ice_shards` 通过本地清 mode + 手动 `ADVANCE_PHASE` 收口。
   - `useCellInteraction.ts:976-1000` 的 `handleEndPhase` 又维护 `endPhaseConfirmPending` 这种纯 UI flag。

#### 判定
- phase-end 这条链**比其他本地 mode 更安全**，因为至少有 `flowHalted` 和 `onAutoContinueCheck`。
- 但它的“进入阻塞 / AI 继续 / 人类 skip / UI 确认提示”仍分散在 FlowSystem、AI、Board 三层。
- **所有权不统一**，只是目前这条链已有补丁式护栏，不是当前最危险的死锁点。

**D39 裁决：⚠️ 部分满足，但仍有多层共同维护同一流程标志的问题。**

---

### D40 后处理循环事件去重完整性 —— **低风险 / 本轮未命中**

#### 事实
- Summoner Wars 当前未实现：
  - `postProcessSystemEvents`
  - 游戏层 `afterEvents` 系统
  - `queueInteraction` + 交互后再回流的游戏层后处理系统
- `execute.ts:957-1060` 有若干命令尾部后处理，但本轮未发现“从输出事件构建去重集合再进入循环”的典型模式。

#### 判定
- 当前用户感知到的“重复弹/重复响”，在 Summoner Wars 里**更像重复请求事件 + 剩余本地 mode 重建**，而不是 D40 典型 bug。

**D40 裁决：✅ 本轮未发现命中证据，但后续若引入游戏层 systems.ts / postProcessSystemEvents，必须重审。**

---

### D41 系统职责重叠检测 —— **高风险**

#### 事实
1. 引擎层已经挂了 Interaction / ResponseWindow 系统（`game.ts:149-153`）。
2. 游戏层真实等待态却主要在：
   - `useGameEvents.ts`
   - `useCellInteraction.ts`
   - `useEventCardModes.ts`
3. `ai.ts` 又只会读取：
   - `sys.interaction.current`
   - `sys.flowHalted`
   - `activeEvents`
4. 这导致“引擎层说自己支持交互”“游戏 UI 也自己维护交互”“AI 只认识引擎层那套”，三者不一致。

#### 判定
这不是“功能点多所以复杂”，而是**同类职责被两套系统分摊**（事件卡已迁移，但其余本地 mode 仍在）：
- 引擎系统：可见、可序列化、AI 可消费
- 本地 UI mode：即时、隐式、AI 看不见

结果就是：
- 真人能点，AI 看不见；
- UI 有提示，服务端不知道；
- 自动反馈拿不到真正等待原因；
- 以后再加 watchdog / 重试 / 自动跳过时，很容易误把“本地 mode 丢失”当成“AI 卡死”。

**D41 裁决：❌ 职责重叠且真相源分裂，是当前 Summoner Wars AI 交互问题的主根因。**

---

### D45 Pipeline 多阶段调用去重 —— **低风险 / 本轮未命中**

#### 事实
- 当前未发现 Summoner Wars 像 SmashUp 那样：
  - 在多个 pipeline 阶段重复调用同一个游戏层后处理函数；
  - 再由该函数重复创建交互/重复触发能力。
- `src/games/summonerwars/domain/systems.ts` 已存在，但当前未发现“同一批事件被多阶段重复消费”的 D45 典型问题。

#### 判定
- 当前 Summoner Wars 的重复交互风险，核心不在 pipeline 多阶段重复调用。
- 真正的问题是：**同一个请求根本没进 pipeline 可见的等待态，只在 UI 本地停留。**

**D45 裁决：✅ 本轮未命中。**

---

## 自动反馈“为什么无法选择”能力审计

### 当前能不能自动带上原因？
**仍留在本地 mode 的交互，不能。**

### 原因
- 对仍留在本地 mode 的请求，服务端没有“选项列表 / disabled 原因 / min/max / 当前步骤”。
- 当前“不能选”的信息大多散落在：
  - 本地高亮计算
  - 本地 `showToast.warning(...)`
  - `validate` 报错（只有真的发命令后才知道）

### 直接后果
自动反馈最多只能说：
- “当前没有进入服务端可见交互”
- “AI 没有合法动作”
- “validate 返回错误 XXX”

但很难精确说出：
- 为什么这一步没有可选项
- 是资源不足 / 目标缺失 / 路径阻挡 / 本地 mode 丢失 / 重复提示重建

**结论**：只要继续使用 UI 本地 mode 作为主等待态，自动反馈就很难做到真正可修复的“带原因上报”。

---

## 已确认的正面项
1. **Summoner Wars 当前没有真正的 response-window reopen 源。**
2. **AI 不会在非自己回合乱出动作。**
   - 证据：`ai.ts:1716-1717`。
3. **AI 当前不会自己制造 undo 循环。**
   - 审计 `src/games/summonerwars/ai.ts`，未发现 `UNDO` / `undo` 指令生成。
4. **phase-end 的 `flowHalted` 链已有一定兜底。**
   - 证据：`flowHooks.ts:292-298`、`ai.ts:1583-1689`。
5. **殉葬火堆是少数已服务端可见且 AI 可解的等待链。**
   - 证据：`ai.ts:352-421`。

## 未收口风险清单（按严重度）

### P0：仍有 UI 本地请求链是 AI 盲区
- rapid fire
- withdraw
- afterMove 一组追加技能
- ice ram trigger
- 魔力阶段事件卡二选一

> ✅ 已迁移出 P0：infection / grab follow / soul transfer / mind capture / ice_shards / feed_beast 已进入 `sys.interaction`（Phase A）。

### P1：reset / 刷新后只恢复少数 phase 技能
- 其余本地等待态可能直接丢失，或下一次重复事件来时被重新建出来。

### P1：自动反馈缺少“不能选原因”
- 因为没有服务端 options/disabled reason 真相源。

### P2：phase-end 流程所有权仍分裂
- FlowSystem / AI / Board 各管一段，虽然能跑，但不够干净。

---

## 本轮审计裁决

### 可以明确说“没命中”的
- **不是**真正的 Summoner Wars response-window reopen 链。
- **不是** Summoner Wars AI 自己发 undo 导致的循环。
- **不是**当前 pipeline 多阶段重复后处理的典型 D45 问题。

### 可以明确说“命中根因”的
- **是**本地 UI mode 与引擎交互系统并存造成的职责分裂。
- **是**大量等待态没有进入服务端可见状态机，导致 AI/自动反馈/兜底推进都拿不到同一份真相源。
- **是**请求事件缺少稳定 requestId / interactionId，重复事件会直接重建本地提示并重复播音效。

### 架构判断
**这是设计问题，不是单点补丁问题。**

如果目标是“AI 不能卡死、自动反馈要带原因、强制跳过要真能兜底”，那么 Summoner Wars 最终仍应把这些本地等待链迁到：
- `sys.interaction`（首选）或
- 等价的服务端持久等待态

否则只能持续靠：
- 本地 mode 补丁
- 特判 AI 动作
- 特判 watchdog
- 特判重复音效/重复弹窗

来止血，但很难一次审计后真正收口。

## 本轮验证记录（已跑）
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/flow.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native`（含本地 AI 血契召唤链路）
- `npm run test:e2e:ci -- e2e/summonerwars/summonerwars-ice-shards-minimal.e2e.ts`
- `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：除灭多目标选择流程"`
- `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：血契召唤收口流程"`
- 复跑记录：2026-04-13 05:04（Asia/Shanghai）血契召唤收口流程通过（断言收紧为服务器权威状态：召唤落点 + 目标伤害 +2；若应致死则移除），证据见 `evidence/summonerwars/summonerwars-blood-summon-e2e-test.md`。

---

## 关键触发链路（按 AI 可见性拆分）

### A. 已进入服务端等待态、AI 当前可消费的链路
1. `FLOW_COMMANDS.ADVANCE_PHASE`
   → `summonerWarsFlowHooks.onPhaseExit()`
   → `triggerPhaseAbilities()`
   → `SW_EVENTS.ABILITY_TRIGGERED(actionId=ice_shards_damage/feed_beast_check)`
   → `createSummonerWarsInteractionSystem.afterEvents()`
   → `createSimpleChoice()` + `queueInteraction()`
   → `state.sys.interaction.current`
   → `buildInteractionActions()` / `buildEmergencyInteractionFallbackAction()`
   → `SYS_INTERACTION_RESPOND/CANCEL`
   → `INTERACTION_EVENTS.RESOLVED/CANCELLED`
   → `applyPhaseEndResolution()`
   → `SW_COMMANDS.ACTIVATE_ABILITY`

2. `FUNERAL_PYRE_HEAL`
   → 等待态不走 `sys.interaction`，但以 `activeEvents` 挂在服务端 core 上
   → `buildPendingActiveEventActions()` 能直接生成 AI 合法动作
   → 这条链是“非 interaction 但仍服务端可见”的例外

3. `SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED / GRAB_FOLLOW_REQUESTED / SOUL_TRANSFER_REQUESTED / MIND_CAPTURE_REQUESTED`
   → `createSummonerWarsInteractionSystem.afterEvents()`
   → `createSimpleChoice()` + `queueInteraction()`
   → `state.sys.interaction.current`
   → AI 通过 `buildInteractionActions()` 生成响应

### B. 仍停留在本地 UI mode、AI 当前不可消费的链路
1. `SW_EVENTS.ABILITY_TRIGGERED(actionId=rapid_fire_extra_attack / withdraw / afterMove:* / ice_ram_trigger / blood_rune_choice / illusion_copy)`
   → `useGameEvents` 创建 `rapidFireMode / withdrawTrigger / abilityMode / afterAttackAbilityMode`
   → `useCellInteraction` / `useEventCardModes` 再继续多步交互
   → 未落入 `sys.interaction`

2. 魔力阶段“打出事件卡还是弃牌”二选一
   → `useCellInteraction` 本地 `magicEventChoiceMode`
   → 未落入 `sys.interaction`

---

## 关键函数 / 关键事件名清单

### 关键函数
- `src/games/summonerwars/ai.ts`
  - `buildInteractionActions()`
  - `buildEmergencyInteractionFallbackAction()`
  - `validateInteractionCommand()`
  - `buildFlowHaltedPhaseEndAbilityActions()`
  - `buildActivatedAbilityActions()`
- `src/games/summonerwars/domain/systems.ts`
  - `createSummonerWarsInteractionSystem()`
  - `applyPhaseEndResolution()`
  - `clearPhaseEndResolution()`
  - `executeSwCommand()`
- `src/games/summonerwars/domain/flowHooks.ts`
  - `hasConfirmablePhaseEndAbility()`
  - `triggerPhaseAbilities()`
  - `onPhaseExit()`
  - `onAutoContinueCheck()`
- `src/games/summonerwars/ui/useGameEvents.ts`
  - 基于 `SW_EVENTS.ABILITY_TRIGGERED/*_REQUESTED` 的 `setAbilityMode / setRapidFireMode / setWithdrawTrigger / setAfterAttackAbilityMode`
  - reset 清理与有限恢复逻辑
- `src/games/summonerwars/ui/useCellInteraction.ts`
  - 本地 mode 点击推进与 `dispatch(SW_COMMANDS.*)` 出口
- `src/games/summonerwars/ui/useEventCardModes.ts`
  - 事件卡多步骤已改为 `sys.interaction` 派生 + RESPOND/CANCEL

### 关键事件名
- 服务端可见且 AI 可解：
  - `INTERACTION_EVENTS.RESOLVED`
  - `INTERACTION_EVENTS.CANCELLED`
  - `SW_EVENTS.ABILITY_TRIGGERED`（仅 phase-end 这部分最终被 bridge 成 `sys.interaction`）
  - `FLOW_EVENTS.PHASE_CHANGED`
- 服务端发出但只被本地 UI 消费：
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=rapid_fire_extra_attack)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=withdraw)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=afterMove:spirit_bond)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=afterMove:ancestral_bond)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=afterMove:structure_shift)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=afterMove:frost_axe)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=ice_ram_trigger)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=blood_rune_choice)`
  - `SW_EVENTS.ABILITY_TRIGGERED(actionId=illusion_copy)`

---

## 是否必须重构交互：本轮静态裁决

### 裁决
**如果目标只是继续给少数 phase-end 链补兜底，可以不立刻全量重构；但如果目标是“AI 房间稳定不死锁 + 自动反馈能带原因 + 后续新增 AI 交互不再继续踩坑”，则必须重构。**

### 为什么说“必须重构”
1. **AI 的真相源和真人 UI 的真相源不是同一份。**
   - AI 读 `sys.interaction` / `flowHalted` / `activeEvents`
   - 真人大量读本地 `useState mode`
2. **自动反馈拿不到结构化原因。**
   - 本地 mode 没有统一 `options / disabled reason / min/max / current step`
3. **重复提示/重复音效无法在服务端统一去重。**
   - 因为请求事件本身不是持久等待态，只是“本地 mode 的触发信号”。
4. **每新增一个技能/事件卡，都会再次决定“走服务端 interaction 还是走本地 mode”。**
   - 这会持续放大 D41（职责重叠）

### 最正确的重构方向
- 把所有“等待玩家继续决策”的链统一收口到**服务端持久等待态**：
  - 优先：`sys.interaction`
  - 次选：至少是等价的、AI 可读、可恢复、可带 reason 的服务端状态结构
- `useGameEvents` / `useCellInteraction` / `useEventCardModes` 只负责**展示**与**提交选择**，不再自己持有真相源
- 所有可选项都要能带：
  - `option id`
  - `disabled`
  - `disabled reason`
  - `step`
  - `sourceId/requestId`
- AI 只消费服务端等待态，不再为本地 mode 单独补特判

### 过渡期最小收口建议
1. 新增/改造 AI 相关交互时，**禁止再新增本地-only mode**。
2. 先把高频死锁链迁到 `sys.interaction`：
   - `mind_capture`
   - `soul_transfer`
   - `grab_follow`
   - `rapid_fire`
   - `withdraw`
   - afterMove 系列
3. 请求事件增加稳定 `requestId/interactionId`，避免重复事件重建本地提示。
4. 音效从“请求事件 immediate”改成“真正 interaction current 可见时再触发”，否则重复请求会重复响。
