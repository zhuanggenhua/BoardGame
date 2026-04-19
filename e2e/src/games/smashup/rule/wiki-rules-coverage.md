# Smash Up（Wiki规则）覆盖检查表（事件级）

> 范围：对照用户提供的 Wiki 规则文本，逐条映射到本项目实现（命令→事件→reduce→后处理/系统）。  
> 明确跳过：Munchkin 的 monster/treasure 牌堆与发奖流程（扩展机制未纳入本次覆盖）。  
> 说明：本表强调“**实现是否覆盖该规则断言**”，并标注**明显偏差/高风险点**与复现思路。

## 0. 实现架构速览（用来读后面的“事件链”）

- **命令校验**：`src/games/smashup/domain/commands.ts`（`validate()`）
- **命令执行→领域事件**：`src/games/smashup/domain/reducer.ts`（`execute()`/`executeCommand()`）
- **事件归约（写入 SmashUpCore）**：`src/games/smashup/domain/reduce.ts`（`reduce()`）
- **领域后处理（onPlay/触发链等）**：`src/games/smashup/domain/index.ts`（`postProcessSystemEvents`）
- **系统 afterEvents 多轮**：`src/engine/pipeline.ts`（步骤 5）+ `src/engine/systems/*`
- **阶段/计分主流程**：`src/games/smashup/domain/index.ts`（`smashUpFlowHooks`、`scoreOneBase()`）
- **响应窗口（Me First / After Scoring）**：`src/engine/systems/ResponseWindowSystem.ts` + `src/games/smashup/game.ts`

## 1. Setup（初始设置）

> 本组即使你说“暂不修”，仍做覆盖标注，便于后续回头补。

### 1.1 选择 2 factions + 蛇形选秀
- **规则断言**：每位玩家选 2 个派系；选秀采用蛇形（顺/逆各一轮）。
- **实现入口**：`su:select_faction`
- **事件链**：
  - 命令：`SU_COMMANDS.SELECT_FACTION`（`commands.ts` 仅 `phase==='factionSelect'` 允许）
  - 事件：`SU_EVENTS.FACTION_SELECTED`
  - reduce：`reduce.ts` `case SU_EVENTS.FACTION_SELECTED`（蛇形 nextPlayerIndex 计算）
- **结论**：✅ 已实现

### 1.2 40 卡牌库（两派系各 20，合并洗牌）
- **规则断言**：每人 2 派系共 40 张作为牌库。
- **实现入口**：`su:select_faction` 全部完成后
- **事件链**：
  - 事件：`SU_EVENTS.ALL_FACTIONS_SELECTED`（由 `domain/reducer.ts` 在选满后发射）
  - reduce：`reduce.ts case SU_EVENTS.ALL_FACTIONS_SELECTED` 写入 `players[pid].deck/hand/factions`
- **结论**：✅ 已实现（牌库构建具体在 `domain/utils.ts buildDeck` 一类工具函数中）

### 1.3 翻开 N+1 bases（N=玩家数）
- **规则断言**：场上 bases 数量为 `N+1`，并维持（除非卡牌改变）。
- **实现入口**：faction 选完后初始化 bases；计分后 replace
- **事件链**：
  - 初始化：`SU_EVENTS.ALL_FACTIONS_SELECTED.payload.bases/baseDeck`
  - 换基地：`SU_EVENTS.BASE_CLEARED`（移除 scored base）→ `SU_EVENTS.BASE_REPLACED`（插入新 base）
- **结论**：✅ 已实现（但“base 弃牌堆/重洗”见 3.9）

### 1.4 起手抽 5
- **规则断言**：每人起手抽 5。
- **实现入口**：`ALL_FACTIONS_SELECTED` 生成 `readiedPlayers[pid].hand`
- **结论**：✅ 已实现

### 1.5 Mulligan（起手无随从可重抽一次）
- **规则断言**：起手无随从时，玩家“可以”选择重抽一次。
- **实现入口**：`domain/reducer.ts` 在 `ALL_FACTIONS_SELECTED` 构建手牌后调用 `autoMulligan`
- **结论**：⚠️ **偏差（自动强制重抽，无交互“may”）**

## 2. Turns（回合 5 阶段）

### 2.1 阶段顺序
- **规则断言**：StartTurn → PlayCards → ScoreBases → Draw2 → EndTurn 循环。
- **实现入口**：FlowSystem + `smashUpFlowHooks`
- **事件链**：
  - 阶段常量：`src/games/smashup/domain/types.ts` `PHASE_ORDER`
  - 推进：`FlowSystem` + `src/games/smashup/domain/index.ts smashUpFlowHooks.getNextPhase()`
- **结论**：✅ 已实现

### 2.2 Start Turn：触发“回合开始”能力/清理
- **规则断言**：回合开始触发 `onTurnStart`；到期效果在回合开始清理。
- **实现入口**：`smashUpFlowHooks.onPhaseEnter(to==='startTurn')`
- **事件链**：
  - 事件：`SU_EVENTS.TURN_STARTED`
  - reduce：`reduce.ts case TURN_STARTED`（重置 talentUsed、清零 tempPower、清除各种 per-turn tracking）
  - 触发：`domain/index.ts onPhaseEnter` 调用 `triggerAllBaseAbilities('onTurnStart', ...)` + `fireTriggers('onTurnStart', ...)`
- **结论**：✅ 已实现

### 2.3 Play Cards：每回合可打 1 minion + 1 action（及 extra）
- **规则断言**：Phase2 允许打 minion/action（及 extra）；不在此阶段不能打普通牌。
- **实现入口**：命令校验
- **事件链**：
  - `su:play_minion`：`commands.ts` 限 `phase==='playCards'`（例外：Me First 窗口）
  - `su:play_action`：`commands.ts` 限 `phase==='playCards'`（例外：Me First/AfterScoring 窗口只允许 special）
- **结论**：✅ 已实现（extra 通过 `SU_EVENTS.LIMIT_MODIFIED` 体系）

### 2.4 Score Bases：仅此阶段检查达标并进行计分
- **规则断言**：只有 Phase3 才会检查/计分。
- **实现入口**：`smashUpFlowHooks.onPhaseEnter(to==='scoreBases')` + `onPhaseExit(from==='scoreBases')`
- **结论**：✅ 已实现（见第 3 章）

### 2.5 Draw 2 + 仅此阶段弃到 10
- **规则断言**：Phase4 抽 2；若手牌>10，仅在此阶段弃到 10。
- **实现入口**：`smashUpFlowHooks.onPhaseEnter(to==='draw')` + `DISCARD_TO_LIMIT`
- **事件链**：
  - 抽牌：`domain/index.ts onPhaseEnter(draw)` → `drawCards()` → `SU_EVENTS.DECK_RESHUFFLED`（如需）→ `SU_EVENTS.CARDS_DRAWN`
  - 弃牌到上限：命令 `SU_COMMANDS.DISCARD_TO_LIMIT`（`commands.ts` 只允许 draw，且必须弃“超出的张数”）
  - reduce：`reduce.ts case CARDS_DISCARDED`（从 hand（以及 deck）移入 discard）
- **结论**：✅ 已实现（但 `CARDS_DISCARDED` 语义扩展见 5.2）

### 2.6 End Turn：触发“回合结束”能力 + 胜利检查
- **规则断言**：EndTurn 触发 end-of-turn；并检查 VP>=15 的胜利条件。
- **实现入口**：`smashUpFlowHooks.onPhaseExit(from==='endTurn')` + `domain/index.ts isGameOver`
- **结论**：✅ 已实现

## 3. Phase3：Score Bases（9 步细化对照）

### 3.1 Step1：ready-to-score 检测（总力量≥breakpoint）
- **实现入口**：`getScoringEligibleBaseIndices(core)`
- **事件链**：
  - `domain/ongoingModifiers.ts getScoringEligibleBaseIndices`：优先 `core.scoringEligibleBaseIndices`（锁定列表），否则实时 `getTotalEffectivePowerOnBase>=getEffectiveBreakpoint`
- **结论**：✅ 已实现

### 3.2 Step2：多基地达标时由当前玩家选择计分顺序
- **实现入口**：`domain/index.ts` 多基地交互 `multi_base_scoring_*`
- **事件链**：交互由 InteractionSystem 维护；选择结果进入 `scoreOneBase(...)`
- **结论**：✅ 已实现

### 3.3 Step3：Before Scoring（Me First! 响应窗口）
- **实现入口**：`onPhaseEnter(scoreBases)` 打开窗口
- **事件链**：
  - 打开：`abilityHelpers.openMeFirstWindow()` → `RESPONSE_WINDOW_EVENTS.OPENED(windowType='meFirst')`
  - 窗口允许命令：`game.ts` ResponseWindowSystem 配置（仅 `su:play_action/su:play_minion`）
  - 领域校验二次约束：`commands.ts`（窗口中 `play_action` 只能 special 且 timing 匹配；`specialTiming='triggered'` 的牌不能进入通用计分响应窗口；`play_minion` 仅 beforeScoringPlayable）
- **结论**：✅ 已实现

### 3.4 Step4：Award VPs（VP 结算按当前力量）
- **实现入口**：`scoreOneBase()`
- **事件链**：
  - `scoreOneBase` 计算排名 → 发 `SU_EVENTS.BASE_SCORED`
  - reduce：`reduce.ts case BASE_SCORED` 给 `players[pid].vp += vp`
- **结论**：✅ 已实现

### 3.5 Step5：Treasures（跳过）
- **结论**：⏭️ 本次范围跳过

### 3.6 Step6：After Scoring（AfterScoring 响应窗口）
- **实现入口**：`scoreOneBase()` 按需打开
- **事件链**：
  - 条件：若任意玩家手牌存在 `specialTiming:'afterScoring'` 的 special action → 打开 `afterScoring` 窗口
  - 打开：`openAfterScoringWindow()` → `RESPONSE_WINDOW_OPENED(windowType='afterScoring')`
  - 校验：`commands.ts` 强约束 timing 匹配
  - 延迟兑现：`SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED/CONSUMED`
- **结论**：✅ 已实现（实现上还包含“窗口关闭后力量变化→可能重新计分”的工程策略）

### 3.7 Step7：Discard all cards on base（同时弃置）
- **实现入口**：`SU_EVENTS.BASE_CLEARED`
- **事件链**：
  - `BASE_CLEARED` 归约：`reduce.ts case BASE_CLEARED`：\n    - base 的 ongoing actions → 各自 owner discard\n    - base 的 minions → 各自 owner discard\n    - minion 的 attached actions → 各自 owner discard\n    - bases 数组移除该 base（索引收缩）
- **结论**：✅ 已实现

### 3.8 Step8：Discard the base（进入基地弃牌堆）
- **规则断言**：base 被弃置到“基地弃牌堆”，可被重洗回 base deck。
- **实现现状**：`BASE_CLEARED` 直接从 `core.bases[]` 删除；**没有** `baseDiscard` 之类集合。
- **结论**：⚠️ **缺失/偏差（没有基地弃牌堆实体）**

### 3.9 Step9：Replace the base + baseDeck 为空则重洗 base discard
- **规则断言**：替换 base；若 baseDeck 空，重洗 base discard 成新 baseDeck。
- **实现入口**：`SU_EVENTS.BASE_REPLACED`（replace）+ `SU_EVENTS.BASE_DECK_SHUFFLED`（可由能力触发）
- **实现现状**：
  - Replace：✅ `reduce.ts case BASE_REPLACED` 会从 `state.baseDeck` 移除抽到的 `newBaseDefId`，并在 `bases` 中插入新 base
  - baseDeck 见底重洗：⚠️ 没有一个“自动重洗”路径；且由于缺少 base discard，无法重洗来源
- **结论**：⚠️ **缺失/偏差（baseDeck 空的通用规则未实现）**

## 4. Playing Cards（打牌语义）

### 4.1 “Play a minion/action means from hand”（除非牌面写明可从弃牌堆等）
- **实现入口**：命令 payload `fromDiscard/fromDeck`
- **结论**：✅ 已实现（另有 `discardPlayability` 子系统管理“从弃牌堆打出”）

### 4.2 Ongoing action：play-on-base/minion 会留在场上，离场弃附属
- **实现入口**：`SU_EVENTS.ACTION_PLAYED` + `SU_EVENTS.ONGOING_ATTACHED/DEtACHED`
- **结论**：✅ 已实现（destroy/return/clear 三条路径都会弃附属）

### 4.3 Special action：只能在特定时机（before/after scoring）打出
- **实现入口**：`commands.ts` + `ResponseWindowSystem`
- **结论**：✅ 已实现

## 5. Zones / Ownership / Controller（区域与归属）

### 5.1 “When a visible card goes to hand/deck/discard, it goes to owner’s zones”
- **实现入口**：`MINION_RETURNED`、`MINION_DESTROYED`、`BASE_CLEARED` 等归约逻辑
- **结论**：✅ 已实现（大多数路径遵循 owner；但见 5.3 与 5.4 的偏差）

### 5.2 Discard 默认指手牌（除非特别说明）
- **实现现状**：`reduce.ts case SU_EVENTS.CARDS_DISCARDED` 会从 **hand 和 deck** 同时移除匹配 uid 并放入 discard。
- **结论**：⚠️ **语义扩展/与 Wiki 不一致风险**（若你希望严格“discard=from hand”，则需额外字段或拆事件）

### 5.3 Attachments discarded when a card leaves play
- **destroy/return/clear**：✅ 已覆盖（`MINION_DESTROYED`/`MINION_RETURNED`/`BASE_CLEARED` 都会把 attachedActions 回各主 discard）
- **place to deck bottom/top**：⚠️ **偏差风险**
  - `reduce.ts case CARD_TO_DECK_BOTTOM`：从基地移除随从时**没有处理该随从的 attachedActions**（会导致附属“丢失/悬空”）
- **结论**：⚠️ **明确高风险缺口**
- **最小复现**：
  1) 对某随从打出 play-on-minion action（附属行动卡在 `attachedActions`）  
  2) 使用外星人 `Disintegrator`（或任意 `CARD_TO_DECK_BOTTOM` 效果）把该随从放到牌库底  
  3) 观察：附属行动卡应进入其 owner discard，但现实现不会

### 5.4 控制权 vs 所有权
- **控制权字段**：`MinionOnBase.controller`；所有权字段：`MinionOnBase.owner` / `CardInstance.owner`
- **已实现的典型例**：`ghost_make_contact` 通过 `ONGOING_ATTACHED/DEtACHED` 改/还 controller
- **结论**：✅ 有实现模型，但“所有权是否可在某些规则下保持不变”需逐卡审计（本表只覆盖框架）

## 6. Deck-empty rule（牌库空时洗弃牌堆）

### 6.1 Draw：牌库空则洗弃牌堆继续抽
- **实现入口**：`domain/utils.ts drawCards()` + `index.ts onPhaseEnter(draw)`
- **事件链**：必要时发 `SU_EVENTS.DECK_RESHUFFLED`（再发 `SU_EVENTS.CARDS_DRAWN`）
- **结论**：✅ 已实现

### 6.2 Reveal/Search/Look：牌库空则洗弃牌堆继续
- **reveal/search**：`abilityHelpers.revealAndPickFromDeck({state,random,playerId,...})` 会在 deckSim 空时 `shuffle(discardSim)` 并通过 `SU_EVENTS.DECK_REORDERED` 落地
- **peek/look top1**：`abilityHelpers.peekDeckTop(state,random,playerId,...)`（已修复）同样在 deck 空时发 `SU_EVENTS.DECK_REORDERED` 并继续 `REVEAL_DECK_TOP`
- **结论**：✅ 已实现（但注意：这里用 `DECK_REORDERED` 而不是 `DECK_RESHUFFLED`，事件语义不完全统一）

## 7. Resolution Order / Reactions（结算顺序与反应）

### 7.1 “先完成所打出的牌的结算，再处理反应”
- **实现入口**：`engine/pipeline.ts`
- **事件链**：
  - execute → reduce（写入 core）→ `domain.postProcessSystemEvents`（onPlay/触发链）→ systems.afterEvents（窗口/交互/流程）
- **结论**：🟡 **部分实现**（有固定触发链，但缺少“通用 reaction window”建模；主要在计分断点开窗口）

### 7.2 mandatory vs optional 的排序（当前玩家决定强制顺序；可选顺时针）
- **实现现状**：`fireTriggers`/`triggerAllBaseAbilities` 多为固定遍历顺序；“顺时针/当前玩家选择”主要出现在 ResponseWindow（Me First/AfterScoring）与少量交互中。
- **结论**：⚠️ **缺失/未统一建模**（可能导致与 Wiki 的“同时触发排序”不一致）

### 7.3 witness 规则（After X 的卡必须“看见”X）
- **实现现状**：触发系统一般以“触发时仍在场”为条件，缺少 LKI/见证快照的统一模型。
- **结论**：⚠️ **存疑/需要按能力逐类核对**（本表标记为系统性风险项）

## 8. 信息可见性（Hand/Deck/Discard 的隐藏与 reveal）

### 8.1 手牌不可公开，只有特定牌（如 Probe）才 reveal
- **实现现状**：`domain/index.ts playerView()` 返回 `{}`（不对 core 做字段裁剪）→ 从架构上“所有信息对所有玩家可见”
- **结论**：❌ **与 Wiki 的保密目标不一致**（但可能是你们项目的刻意选择：单机/同屏/调试友好）

## 9. 已确认的高优先级偏差汇总（建议后续修复顺序）

1) **`CARD_TO_DECK_BOTTOM` 未处理随从 attachedActions**（5.3）——规则明确“离场弃附属”，当前存在实质状态错误风险。  
2) **base discard pile + baseDeck 见底重洗缺失**（3.8/3.9）——会影响长局或换基地很多的局面。  
3) **`CARDS_DISCARDED` 同时从 deck 丢牌**（5.2）——事件语义与规则可能不一致，容易造成未来扩展卡误用。  
4) **信息可见性（playerView 不隐藏）**（8.1）——若目标是线上对战，这是硬性缺口。  
5) **反应排序 / witness 规则未统一建模**（7.2/7.3）——属于“规则精度”层面的系统工程。

---

> 💡 **工程实现规范**：  
> 本文件聚焦“Wiki 规则→事件级覆盖检查”。  
> 关于 **destroy 管线（replacement vs reaction）**、**reaction queue / TriggerInstance**、**witness/LKI**、**事件语义约定** 等具体实现约束，详见同目录下的 `ENGINE_GUIDE.md`（给未来扩展/AI 实现使用）。

