# 引擎层在线 AI watchdog / 强制跳过 / 强制结束回合 — 强口径审计（2026-04-12）

## 2026-08-06 修订：资源占用结论失效，恢复序列改为分片执行

2026-04-12 的真人保护、隐藏交互识别和响应窗口结论需要按 2026-08-14 的分场景修订理解；文末“性能成本可接受”与整体 `APPROVE` 不再覆盖资源占用维度。生产证据已经推翻该结论：

- `/home/admin/BoardGame/logs/game-server-cpu-watch/restart-history.log` 记录了 2026-07-28 至 2026-08-05 共 20 次 `boardgame-game-server` 持续高 CPU 自动重启，平均值为 93.88% 至 99.65%。
- 20 个故障窗口都出现在线 AI watchdog 恢复活动；同一批连续重启通常由同一个房间占据主要日志，且涉及王权骰铸、大杀四方和《The Gang》，排除了单款游戏规则作为共同根因。
- 旧状态版本校验、熔断和重同步已经在生产部署，但 2026-08-04、2026-08-05 仍继续出现接近 99% 的告警，因此这些改动只能减少无效命令，不能解释或修复持续高 CPU。
- 共享根因落在 `src/engine/transport/server.ts` 的 `runOnlineAiRecoverySequence()`：watchdog 每 500ms 检查活跃 AI 房间，单次接管原先可在 `while` 循环中连续执行最多 16 步合法动作/强制推进，没有单时间片工作量边界。复杂或离线 AI 房间因此可以长时间连续占用 Node 单线程；重启清空活跃恢复序列后 CPU 立即恢复到低负载，与该机制一致。

本轮修复把“完成恢复”与“单次占满事件循环”拆开：

- 新增 `onlineAiRecoveryMaxStepsPerSlice`，生产默认每个恢复时间片最多 3 步。
- 达到时间片上限时保留下一候选、清除本次提交标记并返回；下一次 watchdog tick 从该候选继续，不写失败反馈，也不丢失最终交还真人的目标。
- 默认值保留了王权骰铸 `投骰 -> 确认 -> 推进` 等既有三步闭环，同时把单房间一次连续恢复的最坏步数从 16 降到 3。

验证：

- 红测：`online AI watchdog 应按时间片限制连续恢复步数，并在下一 tick 继续交还真人回合` 在旧实现中第一次接管执行了 2 步，断言要求 1 步时失败。
- 绿测：该用例与原有“两步交还真人”用例通过。
- 扩大回归：`npx vitest run src/engine/transport/__tests__/server.test.ts -t "online AI watchdog" --reporter=dot`，134 条通过、122 条未命中筛选。

同类扩审记录：

- 搜索范围：`runOnlineAiRecoverySequence`、`onlineAiRecoveryMaxAdvanceSteps`、`onlineAiRecoveryTickMs`、`resolveNextAiDispatch`，覆盖 `src/engine/transport/server.ts`、`src/engine/ai/localRunner.ts`、浏览器侧自动派发入口和各游戏 `onlineAiRecovery` 配置。
- 命中结论：跨 tick 的多步恢复循环只存在于服务端 `runOnlineAiRecoverySequence()`；本地 AI runner 和浏览器侧入口每次只请求一次下一动作。大杀四方、王权骰铸、召唤师战争的游戏配置只决定候选与强制命令许可，最终都共用同一个服务端调度循环，因此本轮应在共享传输层修复，不在单个游戏打补丁。
- 回归覆盖：生产故障样本跨王权骰铸、大杀四方和《The Gang》；测试按共享 watchdog 行为筛选，覆盖 134 条现有恢复、响应窗口、隐藏交互、合法动作与真人交还路径。
- 残余扩审范围：当前预算按“恢复步骤”计数；单个合法动作仍可能串行包含多条命令，也没有墙钟时间预算。该项不改变本轮把单序列最坏连续步骤从 16 降到 3 的修复结论，但部署后仍需继续观察 CPU；若同类高占用再次出现，下一层动作是补命令数/墙钟预算并采集 profiler 或火焰图，而不是继续提高步骤上限。

当前结论等级：**资源占用根因已定位并完成本地修复与共享链回归；尚未部署生产，因此不能用当前线上低 CPU 证明新代码已经在线生效。**

## 2026-08-14 修订：AI 当前阶段 + human 响应窗口不是“真人响应一律不动”

现实症状：
- DiceThrone 在线 AI 阶段可能卡在真人响应窗口，前端“强制结束 AI 阶段”入口消失或自动结束未触发，表现为 AI 回合无法继续。
- 旧审计把“当前响应者是 human”简化成 watchdog 一律返回空；这能避免误替真人 pass，但也把“AI 当前阶段被真人响应窗口卡住”的合法恢复路径一起挡掉。

修订口径：
- human 自己回合 + human 响应窗口：watchdog 和手动强制都不得出手，窗口必须继续等真人。
- AI 当前阶段 + human 响应窗口：watchdog 和手动强制都应先执行 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，随后按恢复序列继续 `ADVANCE_PHASE` / 游戏特化阶段推进；仍禁止替真人发 `RESPONSE_PASS`。
- 门禁仍是 AI-only：恢复候选的执行玩家必须是非 human AI seat；真人响应者只作为“关闭卡住窗口”的对象，不会被代选或代 pass。

本轮修复：
- `src/engine/transport/onlineAiRecovery.ts`：把 human responder 分支改为先判断当前阶段归属；只有当前阶段属于 AI seat 时才生成 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 候选。
- `src/engine/transport/server.ts`：服务端恢复序列已验证会先强制关闭窗口，再跟随 active-turn 继续推进阶段。
- `src/components/game/framework/widgets/GameHUD.tsx`：setup 阶段不再隐藏“强制结束 AI 阶段”入口；普通弹窗强关仍受 setup 限制。
- `src/pages/onlineAiRuntimeSupport.ts` / `src/pages/matchRoomOnlineStageRuntime.tsx`：恢复旧调试 API 形状，供 E2E 和诊断读取服务端权威状态；这不是恢复旧浏览器 AI seat 执行权。
- `src/hooks/match/useMatchStatus.ts` / `src/pages/useMatchRoomSeatValidation.ts` / `src/pages/matchRoomBridges.tsx`：在线房座位校验增加“快照版本”门禁。现实含义是本地座位凭据只会在连续两次服务端 / 传输快照都确认该座位不存在时清理；同一次坏快照、StrictMode/effect 重放或不可信空传输快照不会立刻把房主打回旁观者。这样避免“本地 seat 被误清 → 房主身份丢失 → 强制结束 AI 阶段入口消失”的同类回归。

验证：
- `npx vitest run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native`：54 passed。
- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "human 响应窗口" --configLoader native`：2 passed，覆盖 AI 阶段先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 再 `ADVANCE_PHASE`，以及 human 自己回合不动。
- `npx vitest run src/components/game/framework/widgets/__tests__/GameHUD.test.tsx --configLoader native`：4 passed。
- `npx vitest run src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx --configLoader native`：13 passed。
- `npx vitest run src/pages/__tests__/MatchRoom.routeIdentity.test.ts src/pages/__tests__/MatchRoom.routeIdentity.test.tsx -t "stored seat|pending clear|坏快照|连续两次|第一次|同一次" --configLoader native`：12 passed / 8 skipped。
- `npx vitest run src/pages/__tests__/matchSeatValidation.test.ts -t "useMatchStatus" --configLoader native`：3 passed / 148 skipped。
- `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts src/pages/onlineAiRuntimeSupport.ts src/pages/matchRoomOnlineStageRuntime.tsx src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx src/components/game/framework/widgets/GameHUD.tsx src/components/game/framework/widgets/__tests__/GameHUD.test.tsx e2e/smashup/smashup-phase-transition-simple.e2e.ts e2e/summonerwars/summonerwars.e2e.ts`：0 errors；仍有既有 warnings。

> 目的：回答“底层是不是设计有问题、为什么会卡死、兜底是否会误伤真人、为什么会弹失败提示、自动上报是否包含无法选择原因”。  
> 本文是**引擎层统一审计**；各游戏的交互类型细节见对应 `evidence/*-ai-interaction-audit-*.md`。

## 审计范围（引擎层）

- 在线 AI 兜底决策：`src/engine/transport/onlineAiRecovery.ts`
- 服务端 watchdog 定时兜底：`src/engine/transport/server.ts`（`runOnlineAiRecoveryTick`）
- 响应窗口底座：`src/engine/systems/ResponseWindowSystem.ts`
- 前端（房主）侧辅助兜底与失败提示：`src/pages/MatchRoom.tsx`
- 在线 AI seat 信任/识别：`src/pages/onlineAiSeats.ts`

## 关键结论（强口径）

### 结论 1：watchdog 的“强制推进/跳过”**默认不会影响真人玩家**（有硬门禁）

**硬门禁位置：**
- 服务端 watchdog（`server.ts`）在每个 tick 内只在可信 seatControllers 里发现 AI seat 时才进入候选；并且候选 playerId 必须是非 human seat。
- 前端 MatchRoom 的强制跳过/强制结束也只会对 `seatControllers[playerId] !== human` 的 seat 提交指令。

**风险边界（必须明确）：**
- 唯一可能“误伤真人”的路径是：`setupData.seatControllers` **错误把真人 seat 标成 AI**。  
  因此项目引入了双层信任门禁：前端 `onlineAiSeats.ts` 只有 `setupData.enableAi === true`（或已存在 `match_ai_creds_`）时才信任 `seatControllers`；服务端 watchdog 兼容缺失 `enableAi` 的旧 AI 房，但 `setupData.enableAi === false` 时必须忽略 setupData 与 state.core 中残留的 AI seatControllers。

### 结论 2：系统性“卡死”根因不是单点 bug，而是**交互可解性/响应窗口闭环/循环动作**三类结构问题

1) **交互无解（unsatisfiable interaction）**
- options 全 disabled、需要目标但无目标、需要可移除状态但全不可移除、multi.min>0 但 options 为空等。
- 若 AI 仍不断尝试不可行动作，就会出现“弃牌↔撤回弃牌”“卖↔撤回卖牌”等循环。

2) **响应窗口闭环问题（responseWindow loop）**
- 典型表现：你“跳过”后立刻又触发响应窗口，反复打开/关闭，伴随音效循环。
- 这可能来自：窗口逻辑本身（`loopUntilAllPass`）、或游戏事件不断重新打开窗口（Bug/规则实现问题）。

3) **动作循环（action-loop）**
- AI 在同一阶段持续重复同一动作（repeat）或两动作交替（alternating）。
- `onlineAiRecovery.ts` 目前只对部分 phase 开启 loop detector（见 `AI_LOOP_PHASES`），未覆盖所有游戏/所有阶段（这属于“明确未覆盖项”，各游戏审计里必须列出）。

### 结论 3：“真正兜底”的必要条件：**服务端必须在 AI seat 未建连时仍能识别并解决隐藏交互阻塞**

之前的结构性缺口是：
- 某些“隐藏交互”可能表现为：`sharedState.sys.interaction.current == null` 且 `isBlocked == true`  
  真正的交互对象只在 AI seat 的 `playerView` 中可见。
- 如果服务端 watchdog 不构造 AI seat 的 `playerView`，那么在 AI seat 未建连时，可能只能退化成发 `ADVANCE_PHASE`，并被交互阻塞门禁拒绝，导致“强制结束失败”提示/重复失败上报。

**本轮改动（已落地）：**
- `src/engine/transport/server.ts` 的 `runOnlineAiRecoveryTick` 在检测到疑似隐藏交互阻塞时，会为每个 AI seat 构造一次 `applyPlayerView(match, playerId)`，并把 `seatStates` 传给 `resolveForceEndTurnForStalledAi`。  
  目标：让服务端 watchdog **即使 AI seat 没建连也能拿到隐藏交互并执行 cancel/force-skip**，从而真正收口。

> 这条结论直接对应你此前的体验：“AI 不断卡死、兜底失效、弹强制结束失败提示”。现在从设计上补齐了“服务端不依赖客户端”的关键缺口。

### 结论 4：watchdog 的“强制结束 AI 回合”不能只推进 1 个阶段，必须支持**连续推进直到交还给真人**
**背景症状**：DiceThrone 等游戏里，一个回合可能跨多个 phase；只推进一次会导致“看似跳过了，但还没回到真人回合”，随后仍可能继续卡死。  
**本轮收敛**：`src/engine/transport/server.ts` 的 `runOnlineAiRecoverySequence` 改为统一 follow-up 循环：只要仍是同一个 AI 玩家在当前回合、且没有 interaction/responseWindow/pendingDamage 等 blocker，就继续推进阶段；并用 `progressMarker` 去重/循环检测兜底。  
**真人保护**：`resolveForceEndTurnRecoveryStep` 会在 `currentPlayerId !== AI playerId` 时返回 `null`，因此不会把真人回合也推进掉（只会把控制权交还给真人）。  
**验证**：`src/engine/transport/__tests__/server.test.ts` 用例 `online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）` 已覆盖并通过。

## “强制结束失败 / 自动跳过失败”提示的含义（别被误导）

这些提示来自前端（房主）侧 `MatchRoom.tsx`：
- `AI 自动跳过失败（reason）`
- `AI 强制结束失败（reason）`

它们并不等价于“对局一定永远卡死”，而是表示：
1) 前端向目标 AI seat 提交的兜底命令被拒绝/未生效；并且  
2) `scheduleRecoveryFailureNotice` 复查后仍然“进度 marker 未变化”（仍卡住）  
所以才弹失败提示。

**强口径目标**是：把这些失败提示压到“极罕见 + 可诊断可复盘”，而不是靠“隐藏提示”骗过用户。

## 自动上报是否包含“为什么无法选择”的信息？

是的（服务端上报为主，前端 toast 为辅）。

服务端 watchdog 上报 payload（`server.ts`）会携带：
- `stateSnapshot`：
  - interaction 快照（shared + seat）
  - selectability 诊断（每个 option disabled/原因线索）
  - `unsatisfiableReason`（从选项与交互数据推导）
  - responseWindow 快照（windowType/sourceId/responderQueue/currentResponderIndex）
  - `legalActions` 摘要（AI 在该状态下认为哪些命令是可执行的）
  - pendingDamage 细节（若命中）
- `actionLog`：用于检测动作循环与复盘行为序列

注意：是否真正“发出去”取决于是否配置了在线反馈 endpoint（`resolveOnlineAiFeedbackEndpoint()`），但即使 endpoint 为空，**快照生成逻辑仍然是“可用于本地诊断”的单一真相**。

## 已知盲区（必须显式写进审计，不得假装收口）

1) **loop detector 覆盖面有限**：仅覆盖 `AI_LOOP_PHASES` 列表中阶段，且只支持 repeat/alternating（不支持 3+ 动作循环）。
2) **响应窗口反复打开的根因**：可能是规则实现问题，watchdog 只能强制关闭/让过；若游戏逻辑持续重新打开，需要回到游戏层修复触发条件。
3) **“无解交互”源头**：很多来自“validate 与 execute 不一致”或“可选项过滤不完整（不可移除状态仍被视为可选）”。这必须在游戏层修复，否则兜底只能救火不能治本。

## 本轮新增审计点：response-window 重触发/重复提示的“看起来像 AI 不停点击”

用户报告的典型体验：
- 我方（human）处于 response window 响应者；
- 点击“跳过/让过”后很快又再次出现响应提示，且可能伴随 `RESPONSE_WINDOW_OPENED` 音效反复播放；
- 同时还可能弹出“AI 强制结束失败/AI 自动跳过失败”之类提示，造成“AI 兜底失效”的错觉。

强口径判定：
1) **human 自己回合里的 human 响应窗口，watchdog 不应出手**；否则会越权影响真人流程。
2) **AI 当前阶段被 human 响应窗口卡住时，watchdog 应先强制关窗再继续 AI 阶段收口**；这不是替 human `RESPONSE_PASS`，而是关闭阻塞 AI 阶段的窗口并回到 AI-only 恢复序列。
3) 若重触发来自 AI 行为（例如 DiceThrone AI 在已确认骰面后仍反复使用重掷类能力，导致多次 `CONFIRM_ROLL → RESPONSE_WINDOW_OPENED`），应优先在 **AI 行为层**减少对 human 的重复打扰，而不是靠强制跳过粗暴吞掉真人响应机会。

已落地的引擎/兜底改动：
- `src/engine/transport/onlineAiRecovery.ts`：当 `responseWindow.current` 存在且当前响应者是 human 时，先判断当前阶段归属；human 当前阶段返回 `null`，AI 当前阶段返回 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 恢复候选。
  验证：`src/engine/transport/__tests__/server.test.ts` 用例 `online AI watchdog 在 AI 当前阶段卡住 human 响应窗口时，应先强关响应窗口` 与 `online AI watchdog 在 human 自己回合的 human 响应窗口中不应强制关窗`。
- `src/engine/systems/ResponseWindowSystem.ts`：新增两层系统级去重门禁：  
  1. 当前窗口已存在时，忽略语义等价 `OPENED`，避免重置 responder 进度；  
  2. 同一批事件里 `CLOSED` 后若没有任何非响应窗口业务事件，又收到语义等价 `OPENED`，则忽略该 reopen。  
  目的：直接压住“跳过后立刻又弹响应 / 音效循环”的系统级重复打开噪音。详见 `evidence/engine/response-window-retrigger-system-audit-2026-04-12.md`。

**新增（前端兜底提示去重）：MatchRoom 的 trackerKey 去除易变字段**
- 旧行为：`MatchRoom.tsx` 的强制结束/强制跳过 trackerKey 包含 `progressMarker`，而该值会带 `responseWindowId/interactionId` 等高频变化字段。  
  当同一类卡死反复 reopen（windowId 变化但语义不变）时，会被视为“新 incident”，导致失败提示重复弹出。
- 修复：trackerKey 改为 `playerId + reason + fingerprintHint/attemptKey + turnNumber + phase`，去除易变 id。  
  目的：同一语义卡死只提示一次，避免“像 AI 在不停点击”的噪音体验。
- 文件：`src/pages/MatchRoom.tsx`

## 最终判定（引擎层）

- 引擎层整体设计方向是正确的：**只对 AI seat 出手、带诊断快照、支持多步收口、失败可上报**。
- 但在“真正兜底”的严格标准下，服务端必须具备“AI seat 不在线也能识别隐藏交互并 cancel/skip”的能力；本轮已补齐该关键缺口。
- 后续仍要按每个游戏的交互矩阵持续审计“无解交互”来源，否则依旧会出现循环与卡死，只是从“永远卡死”退化成“频繁触发兜底”。

---

## 架构级验收（2026-04-12）

验收结果：**APPROVE（通过）**

验收要点（静态审查 + 风险评估）：
1. 文档主结论与代码一致：  
   - watchdog 只对 AI seat 出手；  
   - “强制结束失败/自动跳过失败”提示来自前端兜底复查后仍无进展；  
   - 服务端上报包含 interaction/responseWindow/selectability/unsatisfiableReason/legalActions 等诊断字段。
2. `server.ts` 在隐藏交互阻塞（`current == null && isBlocked == true`）时构造 AI seat 的 `playerView` 以识别隐藏交互，方向正确且必要；不会误伤真人。原“性能成本可接受”结论已被 2026-08-06 生产 CPU 证据推翻，资源占用改按本页修订后的分片合同验收。
3. 三游戏审计文档满足强口径最低线：有证据链接 + 未覆盖项清单 + 不夸大成“全仓 100% 收口”。

保留风险（需要在后续任务里继续治理，不能靠 watchdog 兜底长期拖着）：
- hidden interaction 识别仍依赖 `isBlocked === true` 契约；若某游戏没正确置位会漏检。
- watchdog tick 下 `playerView` 必须保持**纯函数/无副作用/不过重计算**；否则可能把“只在发包时跑”的昂贵逻辑带进后台 tick。
- response-loop 反复重开往往是游戏层根因，watchdog 只能救火不能治本。

> 2026-08-06 状态修订：原 `APPROVE` 仅保留在真人保护、隐藏交互识别和功能闭环维度；资源占用维度的旧审批失效，以本页顶部修订为准。
