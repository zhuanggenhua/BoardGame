# 引擎层在线 AI watchdog / 强制跳过 / 强制结束回合 — 强口径审计（2026-04-12）

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
1) **watchdog 在 responseWindow 当前响应者为 human 时不应出手**（否则会被 ResponseWindowSystem 的“当前响应者门禁”拒绝，形成误报与失败提示）。  
2) 若重触发来自 AI 行为（例如 DiceThrone AI 在已确认骰面后仍反复使用重掷类能力，导致多次 `CONFIRM_ROLL → RESPONSE_WINDOW_OPENED`），应优先在 **AI 行为层**减少对 human 的重复打扰，而不是靠强制跳过粗暴吞掉真人响应机会。

已落地的引擎/兜底改动：
- `src/engine/transport/onlineAiRecovery.ts`：当 `responseWindow.current` 存在且当前响应者是 human 时，`resolveForceEndTurnForStalledAi()` 直接返回 `null`，避免 watchdog 误触发。  
  验证：`src/engine/transport/__tests__/server.test.ts` 新增用例 `online AI watchdog 在 responseWindow 当前响应者为 human 时不得误触发强制结束 AI 回合`。
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
2. `server.ts` 在隐藏交互阻塞（`current == null && isBlocked == true`）时构造 AI seat 的 `playerView` 以识别隐藏交互，方向正确且必要；不会误伤真人，性能成本可接受。
3. 三游戏审计文档满足强口径最低线：有证据链接 + 未覆盖项清单 + 不夸大成“全仓 100% 收口”。

保留风险（需要在后续任务里继续治理，不能靠 watchdog 兜底长期拖着）：
- hidden interaction 识别仍依赖 `isBlocked === true` 契约；若某游戏没正确置位会漏检。
- watchdog tick 下 `playerView` 必须保持**纯函数/无副作用/不过重计算**；否则可能把“只在发包时跑”的昂贵逻辑带进后台 tick。
- response-loop 反复重开往往是游戏层根因，watchdog 只能救火不能治本。
