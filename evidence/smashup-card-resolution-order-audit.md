# 大杀四方 Card Resolution Order 审计

## 审计范围

- 审计对象：`Card Resolution Order` 在 Smash Up 域内的实现状态
- 权威来源：用户指定的 [Smash Up Wiki Rules](https://smashup.fandom.com/wiki/Rules)
- 本轮重点：
  - `Step 1/2` 的“先结当前牌，再结被它打断的东西”
  - `Step 3` mandatory 先于 optional
  - `Step 4` 可选反应与手牌 `Special` 的统一轮询
  - 基地计分中的 `beforeScoring / whenScoring / afterScoring`
  - afterScoring 多张牌链式结算时的触发资格快照

## 结论

- 当前实现已经不再主要依赖旧的 `ResponseWindow` 去裁决 Smash Up 反应顺序。
- Smash Up 现在以 `smashupReactionSession` 为主调度，`queued trigger` 执行后也会重新进入统一的 `postProcessSystemEvents`。
- 本轮继续把 `commands.ts` 与 `reducer.ts` 的 Step 4 出牌/结算门禁改成 `smashupReactionSession` 优先，`responseWindow` 只保留镜像展示与 legacy 阻断用途。
- 这意味着基地计分、`meFirst`、大副、托尔图加、普通 `onMinionPlayed / onTurnStart / onTurnEnd` 这几条最容易出错的链，已经收口到同一套反应模型里。
- 本轮回归中，用户最关心的“afterScoring 链里大副先拿到资格，后续即使被移走也仍应继续结算”已经通过。
- 仍有残余风险：`Phase 2` 还不能宣称“所有普通出牌与所有普通事件都已全量审计完成”，但 `onActionPlayed` 已补上定向顺序证据。

## Rules Step 1-5 对照

### Step 1. 先完成刚刚打出的牌

- 现状：已部分落地，并且这轮又补强了一层。
- 证据：
  - [`src/games/smashup/domain/reactionSession.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/reactionSession.ts) 中 `executeReactionCommand()` 先执行当前命令，再统一走 `applyReactionPostProcessing()`。
  - 同文件 `executeQueuedTrigger()` 现在也不再只吐出原始事件，而是会先 reduce，再进入 `applyReactionPostProcessing()`。
- 规则意义：
  - 不管这是“当前玩家主动打的牌”，还是“玩家在反应窗口里选中的一个 queued trigger”，它内部产生的移动、消灭、影响、检视牌库等后续事件，都会重新回到统一后处理，不会丢在外面变成半套时序。

### Step 2. 如果打断了别的结算，先回去把被打断的东西结完

- 现状：基础框架已落地。
- 证据：
  - [`src/games/smashup/domain/reactionSession.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/reactionSession.ts) 中 `continueSuspendedReactionIfNeeded()` 和 `advanceSmashUpReactionSession()` 会在单次动作完成后恢复当前 reaction frame。
- 规则意义：
  - 一个反应动作创建的子交互结完后，会回到同一个 reaction session 继续推进，而不是丢失原来的 frame。

### Step 3. mandatory 先结，当前玩家只在 mandatory 之间选顺序

- 现状：已落地。
- 证据：
  - [`src/games/smashup/domain/reactionSession.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/reactionSession.ts) 中 `buildReactionOptions()` 会按 session phase 过滤可选项。
  - 同文件 `advanceSmashUpReactionSession()` 会先尝试清空 mandatory，再进入 optional。
- 测试：
  - [`src/games/smashup/__tests__/reactionQueueOrdering.test.ts`](D:/deathcats4-BoardGame/src/games/smashup/__tests__/reactionQueueOrdering.test.ts)
  - [`src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts`](D:/deathcats4-BoardGame/src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts)
  - [`src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts`](D:/deathcats4-BoardGame/src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts)
- 审计结论：
  - 当前玩家可以在同时触发的 mandatory 之间决定先后。
  - optional 不会在 mandatory 没清空前提前露出来。

### Step 4. optional 与手牌 Special 统一顺时针轮询，允许先 pass 后重新加入

- 现状：基地计分相关链已落地，`meFirst` 这条链的循环行为有明确测试。
- 证据：
  - [`src/games/smashup/domain/reactionSession.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/reactionSession.ts) 用同一个 `smashup_reaction_choose` 入口列出：
    - 场上的可选触发
    - 手牌可打的 `Special`
    - `pass`
  - session 内部维护 `consecutivePasses`，只在全员连续 pass 后关闭当前 frame。
- 测试：
  - [`src/games/smashup/__tests__/meFirst.test.ts`](D:/deathcats4-BoardGame/src/games/smashup/__tests__/meFirst.test.ts) 中 `loopUntilAllPass` 系列用例已经覆盖：
    - 一人行动后循环重启
    - 全员连续 pass 才关闭
    - 无合法响应时窗口自动关闭
- 审计结论：
  - 这一条在基地计分相关窗口里已经不再是“两套系统各管一半”，而是统一由 reaction session 驱动。

### Step 5. 当前动作牌的最终去向

- 现状：本轮不是重点，但没有看到这轮改动打坏原有 discard 落点。
- 说明：
  - 本文不把 Step 5 记为本轮新增收口点。
  - 若后续要对“动作牌落弃牌堆的最终时点”做完整签字，仍建议单独补一轮 `onActionPlayed` 审计。

## 基地计分链现状

### beforeScoring / whenScoring / afterScoring 已接到统一反应会话

- 证据：
  - [`src/games/smashup/domain/index.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/index.ts) 中 `scoreOneBase()` 会分别为
    - `score-before:${baseIndex}:${now}`
    - `score-when:${baseIndex}:${now}`
    - `score-after:${baseIndex}:${now}`
    建立 reaction frame。
  - 同函数中，`collectBaseAbilityTriggers()` 与 `collectTriggers(..., 'afterScoring')` 会先把同一时点应有的东西全部入队，再启动 reaction session。
- 审计结论：
  - 这正是“大副先取得触发资格，后面哪怕被别的 afterScoring 效果移走，也不该因为活体检查失败而整个失效”的必要前提。

### deferred post-scoring 仍然延后，但不会把同一基地重新计分

- 证据：
  - [`src/games/smashup/domain/index.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/index.ts) 中 `scoreOneBase()` 只有在 afterScoring 完整跑完后，才会把 `BASE_CLEARED / BASE_REPLACED / onBaseRevealed` 作为 deferred 事件挂到当前结算链上。
  - [`src/games/smashup/domain/scoringSession.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/scoringSession.ts) 配合当前 scoring session 记录“正在结算哪座基地”。
- 测试：
  - [`src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts`](D:/deathcats4-BoardGame/src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts)
  - [`src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`](D:/deathcats4-BoardGame/src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts)
- 审计结论：
  - 当前关键链已经符合“整座基地先结完整，再去补清场和换基地，再看下一座”的方向。

## 触发资格快照

- 现状：这轮明确补强了几个之前最容易漂移的入口。
- 证据：
  - [`src/games/smashup/domain/reducer.ts`](D:/deathcats4-BoardGame/src/games/smashup/domain/reducer.ts)
    - `processMoveTriggers()`
    - `processAffectTriggers()`
    - `processDeckInspectionTriggers()`
  - 这些入口现在都会给 queued trigger 显式写入 `sourceEventId` 与 `frameId`。
- 规则意义：
  - 触发资格在入队时锁定。
  - 执行时可以重新看目标是否合法，但不能重新改写“它当时是否已经有资格触发”。

## 本轮实跑验证

- 已执行：
  - `npx vitest run src/games/smashup/__tests__/commandsValidation.test.ts`
  - `npx vitest run src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`
  - `npx vitest run src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/meFirst.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts`
  - `npx vitest run src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/meFirst.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts`
  - `npx vitest run src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueBaseReplaceLki.test.ts src/games/smashup/__tests__/reactionQueueOnBaseRevealed.test.ts src/games/smashup/__tests__/reactionQueueOnMinionDiscardedFromBase.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts`
- 结果：
  - 关键基地计分链：通过
  - `meFirst` 循环与 pass 逻辑：通过
  - mandatory 排序：通过
  - 大副 afterScoring 资格快照：通过
  - 普通 `onMinionPlayed / onTurnStart / onTurnEnd` 统一 reaction session：通过
  - `onActionPlayed` 的“基地能力 + 场上触发器”同 frame 排序交互：通过
  - optional 顺时针轮询里“先 pass，后面重新加入”：通过
  - 基地被替换后，旧基地已入队触发仍保留 LKI 标签并进入同一 reaction frame：通过

## 残余风险

- `onActionPlayed` 已有定向顺序回归，但还没覆盖所有牌型与所有目标形态。
- 旧 `reaction_queue_choose_next` 兼容壳仍在，`ResponseWindow` 也还没从 Smash Up 域内完全删干净，只是不再负责这轮已覆盖的 Step 4 真相裁决。
- 仓库里还有不少旧证据文档存在编码历史问题，不能拿那些乱码文档当这轮收口的证明。
- 因为 Smash Up 之前同时存在 response window、reaction queue、base scoring session 多套老逻辑，后续仍建议继续把普通出牌场景完全收口到同一会话模型，再做一次全量签字。

## 本轮裁定

- 如果问题是“基地计分时为什么会出现一堆 afterScoring 连锁，而且大副有时像被吞了”，这一轮的答案是：
  - 现在已经按“先锁资格，再统一进入同一 reaction frame，再在 frame 结束后补发 deferred 清场”去执行。
- 如果问题是“能不能宣布整个 Card Resolution Order 全部做完”，答案是：
  - 还不能说 100% 全域完工。
  - 但基地计分相关、用户持续反馈的 simultaneously resolving / 大副 / 多基地 / meFirst 这条主链，已经进入可提交审阅的状态。

## 2026-04-11 续补

- 新增 `smashupReactionWindowPresentation`，把 `smashupReactionSession` 变成 Smash Up UI 层的优先真相源。
- `Board.tsx` 已改为优先读取 session 里的 `windowType / activePlayerId`，不再用 legacy `responseWindow` 决定当前是不是 `meFirst / afterScoring`、轮到谁响应、是否还能在计分阶段显示结束回合按钮。
- `MeFirstOverlay.tsx` 已改为 session-first；`responseWindow` 只保留给“响应进度徽记”这类镜像展示信息。
- 这轮继续确认：`reaction_queue_choose_next` 已不再是 Smash Up 运行时 handler，统一入口仍是 `smashup_reaction_choose`。
- 已通过的直接回归：
  - `src/games/smashup/__tests__/commandsValidation.test.ts`
  - `src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts`
  - `npm run typecheck`
- 当前仍未完全收口的残留：
  - `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`
  - `src/games/smashup/__tests__/response-window-skip.test.ts`
- 这两组旧测试暴露出的真实残差不是“session-first 主链失效”，而是旧测试仍混着旧时序假设：
  - 仍把“直接进入 afterScoring”当默认前提，没有显式经过 `score-before / meFirst`。
  - 仍把“当前 simple-choice 不能被响应动作打断”与“统一反应选择器先出现”混在一起断言。
  - 仍把镜像 `responseWindow` 的关闭时点，当成 optional 循环是否结束的唯一证明。
