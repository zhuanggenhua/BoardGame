# 全链路审计：AI 卡死 / response-window 重触发 / 交互循环 / 失败提示噪音（2026-04-12）

> 背景：用户在 DiceThrone / Summoner Wars 等对局中反复遇到：
> - AI 卡死（不推进、不出牌、不结束）
> - 点击“跳过响应/跳过阶段”后立刻又弹响应，甚至音效循环
> - 弹出 `AI 强制结束失败` / `AI 自动跳过失败` 提示
> - AI 出现“弃牌↔撤回弃牌”“卖↔撤回卖牌”等重复交互行为
>
> 本文目标：不把问题当成单点 bug，而是把“全链路”拆成可审计的责任边界与可验证的兜底策略。
>
> 补记：**active-turn 连续推进**修复已在「### 4) watchdog 推进策略升级」中明示记录（本轮仅补记口径，无新增测试）。

## 审计范围（全链路分层）

1) **UI 层（房主/观战者）**
- AI 辅助兜底与失败提示：`src/pages/MatchRoom.tsx`
- 游戏 Board 的本地自动跳过（示例：DiceThrone 响应窗口 auto-pass）：`src/games/dicethrone/Board.tsx`

2) **引擎系统层**
- ResponseWindow：`src/engine/systems/ResponseWindowSystem.ts`
- Interaction：`src/engine/systems/InteractionSystem.ts`（通过 `sys.interaction`）
- EventStream（驱动音效/动画）：`src/engine/systems/EventStreamSystem.ts` + `src/lib/audio/useGameAudio.ts`

3) **传输层**
- 服务端 watchdog + 自动上报：`src/engine/transport/server.ts`
- watchdog 候选与诊断：`src/engine/transport/onlineAiRecovery.ts`
- seatControllers 信任门禁：`src/pages/onlineAiSeats.ts`

4) **游戏层（以 DiceThrone 为代表性问题源）**
- AI 动作生成：`src/games/dicethrone/ai.ts`
- 领域事件（打开响应窗口/防止重复打开）：`src/games/dicethrone/domain/*`

## 症状 → 根因分类（强口径）

### A. “AI 不停点”错觉的常见来源
1) **watchdog 越权**：在 *human* 正在响应窗口时出手，必然被系统门禁拒绝 → 产生失败提示噪音。
2) **AI 行为反复触发响应窗口**：例如 DiceThrone 在 `rollConfirmed=true` 后继续重掷骰子，导致 `CONFIRM_ROLL → RESPONSE_WINDOW_OPENED` 多次发生，真人听到音效反复播放。

### B. “跳过后立刻又弹响应”的两种本质
1) **机制允许的循环**（例如 Smash Up `loopUntilAllPass`）：不是 bug，属于规则/系统设计。
2) **领域事件重复发射 / 状态去重缺失**：关闭后立刻又开，属于 bug 或规则实现缺口，需要回到领域层修复触发条件。

> 2026-04-12 补充：引擎层 `ResponseWindowSystem.afterEvents()` 已新增“语义等价 OPENED 去重”与“同批 CLOSED → 无业务进展 → 等价 OPENED 忽略”两道门禁。详见 `evidence/engine/response-window-retrigger-system-audit-2026-04-12.md`。

### C. “强制结束/自动跳过失败”提示的真实含义
这些提示来自 `MatchRoom.tsx`：表示“提交兜底命令被拒绝 + 复查后仍卡住”。
它不是单纯 UI 问题，而是**兜底在不该出手的时机出手**或**候选动作本身无效**。

## 全链路关键门禁（已落地）

### 1) watchdog 不得在 responseWindow 当前 responder 为 human 时出手（真人保护）
**原因**：ResponseWindowSystem 按“当前响应者”门禁执行 `RESPONSE_PASS/推进`，非 responder 出手必然失败；watchdog 出手只会制造失败噪音。

**实现**：`src/engine/transport/onlineAiRecovery.ts`
当 `responseWindow.current` 存在且 currentResponder 是 human → `resolveForceEndTurnForStalledAi()` 返回 `null`。

**验证（单测）**：`src/engine/transport/__tests__/server.test.ts`
用例：`online AI watchdog 在 responseWindow 当前响应者为 human 时不得误触发强制结束 AI 回合`
（本轮未运行测试）

### 2) 服务端 watchdog 能在 AI seat 未建连时处理“隐藏交互阻塞”
**原因**：某些隐藏交互只在 AI seat 的 `playerView` 可见，sharedState 只表现为 `isBlocked=true`。若服务端不构造 seatView，则 AI seat 未建连时 watchdog 可能失明。

**实现**：`src/engine/transport/server.ts`
在 `sys.interaction.current == null && isBlocked == true` 时，为每个 AI seat 构造一次 `applyPlayerView` 并传入 `resolveForceEndTurnForStalledAi`。

### 3) DiceThrone：AI 不在已确认骰面后继续做重掷类被动动作（减少 response-window 重触发）
**原因**：`rollConfirmed=true` 后重掷会重置确认状态，引发再次 `CONFIRM_ROLL → RESPONSE_WINDOW_OPENED`，对真人造成重复打扰与音效循环体验。

**实现**：`src/games/dicethrone/ai.ts`
当 `state.core.rollConfirmed === true` 时，不再产出 `rerollDie` 类型 `use-passive-ability`。

**验证（单测）**：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- `本地 AI 在已确认骰面时不应再使用教皇税重掷骰子（避免反复打开响应窗口打扰真人）`
- `本地 AI 在未确认骰面且有可重掷骰子时应能使用教皇税重掷骰子`
（本轮未运行测试）

### 4) watchdog 推进策略升级：active-turn / 交互恢复后可连续推进多个阶段，直到交还给真人回合
**背景症状**：用户在 DiceThrone 遇到“提示跳过了一个阶段，但没有直接回到我的回合，随后仍可能卡死”。
**根因**：watchdog 过去在 `candidate.reason === 'active-turn'` 时只会执行一次 `ADVANCE_PHASE`，不会继续 follow-up；并且对 `requiresConfirmedAdvancePhase` 也只允许推进 1 次。
在“AI 回合需要多次 phase advance 才能结束”的游戏里，这会导致 watchdog 看似成功（marker 变化），但实际上仍停留在 AI 回合中间阶段。

**实现**：`src/engine/transport/server.ts`（`runOnlineAiRecoverySequence`）
- 去掉对 `candidate.reason === 'active-turn'` 的单步限制；进入统一的 follow-up 循环。
- follow-up 循环里允许多次推进（`allowAdvancePhase: true`），并以 `progressMarker` 去重/循环检测兜底。
- 仍然只对 **AI seat** 生效：`resolveForceEndTurnRecoveryStep` 会在 `currentPlayerId !== candidate.playerId` 时立即停止，不会把人类回合也推进掉。

**验证（单测）**：`src/engine/transport/__tests__/server.test.ts`
用例：`online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）`
本轮未运行测试（历史有对应用例）：`npm test -- src/engine/transport/__tests__/server.test.ts`

### 7) 自动反馈携带“无法选择原因”与选项诊断
**实现**：`src/engine/transport/server.ts`
- `buildUnsatisfiableInteractionStateSnapshot()` 会附带：
  - `interaction.seatSelectability`（可选项可用性诊断）
  - `resolveUnsatisfiableReasonFromInteraction()` 的原因枚举
  - `disabledReason/disabledReasonKey`（若 options 提供）
**用途**：当 watchdog 失败或强制跳过触发时，上报日志能够携带“为什么无法选择”。
（本轮未运行测试）

### 5) watchdog 兼容缺失 enableAi，但必须尊重 enableAi=false
**原因**：部分老房间缺少 `enableAi` 标记，但仍有 AI seatControllers；若强依赖 enableAi 会导致 watchdog 不启动。反过来，若用户明确 `enableAi=false`，服务端继续信任残留 seatControllers，就可能把真人座位当成 AI 座位自动推进。
**实现**：`src/engine/transport/server.ts` 与 `src/engine/transport/onlineAiWatchdogSeatControllers.ts` 内新增显式禁用门禁：
- `enableAi` 缺失：继续按旧房间兼容口径，根据 seatControllers 中是否存在 AI 类型启动。
- `enableAi === false`：忽略 setupData 与 state.core 中残留的 AI seatControllers。
**风险门禁**：仍以 `seatControllers[playerId].type === 'human'` 作为候选保护；新增门禁先把显式禁用 AI 的房间整体收敛为全真人，避免真人座位被旧 AI 配置误推进。
**验证（单测）**：
- `src/engine/transport/__tests__/onlineAiWatchdogSeatControllers.test.ts`：`显式 enableAi=false 时 watchdog 应忽略残留 AI 座位定义`
- `src/engine/transport/__tests__/server.test.ts`：`online AI watchdog 在 enableAi=false 时不得根据残留 seatControllers 推进真人座位`
- `src/engine/transport/__tests__/server.test.ts`：`online AI watchdog 缺少 enableAi 标记时仍应根据 seatControllers 启动`
**本轮结果（2026-07-16）**：上述定向用例均通过；`setupMatch 应把 AI 座位写入 undo 状态` 也通过，确认正常 AI 房未被误降级。

### 6) 前端 seat 校验不应误把真人房识别成 AI 房
**原因**：UI 侧若把真人房识别成 AI 房，会导致提示/按钮出现错位，并可能误导用户“AI 被强制跳过”。
**实现**：`src/pages/onlineAiSeats.ts` + `src/pages/__tests__/matchSeatValidation.test.ts`
用例：
- `缺少 enableAi 标记时，即使残留了 seatControllers 也不得把真人房识别成 AI 房`
- `显式 enableAi=false 时，应忽略残留的 AI seatControllers 与本地旧凭据`
（本轮未运行测试）

## 音效循环：链路判定（不是“音效系统坏了”）

音效消费位于 `src/lib/audio/useGameAudio.ts`：
- 使用 eventStream entry 的 `eventId`/签名指针跳过历史，避免重播；
- 同一批次 key 去重（`playedKeys`）+ 全局 80ms 节流。

因此如果你听到“响应打开音效不停响”，通常是：
**事件真的在不停产生（例如 `RESPONSE_WINDOW_OPENED` 不断被重新发射）**，而不是音效系统重复播放同一条历史事件。

DiceThrone 的响应窗口音效还有额外门禁：只对 responderQueue 包含自己时播放（避免信息泄露）。
因此“我方一直听到响应音效”几乎可以判定为：**我方被不断纳入 responderQueue**（窗口在重复打开或重复切换）。

## 未覆盖项（必须继续治理的全链路问题）

1) **responseWindow 关闭后立刻重开**的领域根因：
需要逐窗口类型（afterRollConfirmed/afterCardPlayed/afterAttackResolved）检查“去重字段/序列号”是否齐全（DiceThrone 已对 afterAttackResolved 做过序列去重，但 afterRollConfirmed 仍属“状态驱动”的自然重开）。

2) **stale responderQueue / currentResponderIndex 错乱**：
如果队列里 currentResponder 被错误保留为 human，watchdog 现在会刻意不接管；这类 bug 必须在 ResponseWindowSystem 或领域事件源头修复。

3) **Summoner Wars 的“响应重触发/音效循环”**：
已完成专项审计与最小修复（`flowHalted` 重复提示/音效回放），并完成 Phase A 关键交互迁移（infection / grab_follow / soul_transfer / mind_capture / ice_shards / feed_beast），详见 `evidence/summonerwars/summonerwars-ai-interaction-audit-2026-04-12.md`。
本轮已运行 E2E：
- `evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`
**仍保留的结构性风险**：Summoner Wars 仍有多条“领域事件 → UI 本地 mode”链路未落到 `InteractionSystem`（rapid_fire / withdraw / afterMove / magic 二选一等），AI 仍看不到这类交互，存在“AI 看不见但真人能操作”的隐性分叉风险，需要后续继续治理（事件卡 Phase B 已纳入本轮验收，剩余为非事件卡本地 mode）。

4) **AI 循环动作的检测覆盖面**：
`onlineAiRecovery.ts` 的 action-loop detector 只覆盖部分 phase 且仅 repeat/alternating；三步以上循环仍可能漏检。
此外它依赖 `sys.actionLog.entries[].kind`，而 DiceThrone 的 ActionLog 允许列表 **不包含** `DISCARD_CARD` / `UNDO_SELL_CARD` 等交互命令，
因此“弃牌↔撤回（卖牌）”这类循环很可能**不会被检测到**（actionLog 没有记录 → detector 看不到）。

## 关联审计文档（单一真相源索引）
- 引擎 watchdog 强口径审计：`evidence/engine/online-ai-watchdog-strong-audit-2026-04-12.md`
- 引擎 ResponseWindow 重触发专项：`evidence/engine/response-window-retrigger-system-audit-2026-04-12.md`
- DiceThrone AI 总审计：`evidence/dicethrone/dicethrone-ai-interaction-audit-2026-04-11.md`
- DiceThrone response-window 重触发专项：`evidence/dicethrone/dicethrone-response-window-retrigger-audit-2026-04-12.md`
- Smash Up AI 强口径审计：`evidence/smashup-ai-interaction-audit-2026-04-11.md`
- Summoner Wars watchdog 链审计：`evidence/summonerwars/summonerwars-ai-interaction-audit-2026-04-12.md`
- Summoner Wars ice_shards E2E 证据：`evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`
- Summoner Wars 事件卡 E2E 证据：`evidence/summonerwars/summonerwars-event-annihilate-e2e-test.md`
- Summoner Wars 事件卡 E2E 证据：`evidence/summonerwars/summonerwars-blood-summon-e2e-test.md`

## 补充专项：AI action-loop detector 覆盖面审计（2026-04-12）

### 审计入口与命中维度
- 入口文件：`src/engine/transport/onlineAiRecovery.ts`（`AI_LOOP_PHASES` / `extractRecentActionKinds` / `detectAiActionLoop`）
- 依赖链路：`src/engine/systems/ActionLogSystem.ts` → `src/games/dicethrone/game.ts`（`ACTION_LOG_ALLOWLIST` + formatter）→ `src/games/dicethrone/ai.ts`（AI legalActions）
- 诊断上报参考：`src/engine/transport/server.ts`（`buildOnlineAiRecoveryActionLog` 仅截尾部 5 条）
- 本节命中维度：**D8（时序正确）/ D9（幂等与重入）/ D39（流程控制标志清除完整性）/ D40（后处理循环事件去重完整性）/ D41（系统职责重叠检测）/ D45（Pipeline 多阶段调用去重）**
- 本轮结论来自静态审计；**未跑测试、未改源码**。

### detector 当前真实合同（不是“通用循环检测器”）
1. **只在 phase 白名单内工作**：`main1/main2/discard/income/upkeep/playCards/scoreBases/draw/offensiveRoll/targetingRoll/defensiveRoll/summon/move/build/attack/magic/draw` 之外的循环，当前 detector 直接忽略。
2. **只读 `sys.actionLog.entries[].kind`**：不读取命令历史、不读取撤回栈、不读取 eventStream，也不直接看 `legalActions` 序列。任何没进 ActionLog 的动作，detector 天然看不见。
3. **只取当前 AI 自己最近 6 条 action kind**：`actorId !== playerId` 的动作被过滤；窗口外历史全部丢失。
4. **只识别两种模式**：
   - `repeat`：最近样本全部同一种 kind；
   - `alternating`：最近样本只有 2 种 kind，且必须严格 `A/B/A/B/...`，相邻不能相同，并且两种都至少出现 2 次。
5. **命中后的 recovery 也只有单一动作**：当前 `reason='action-loop'` 时，恢复动作是提交 `ADVANCE_PHASE`，它不是“回滚到稳定态”，只是尝试把流程往后推。

### 明确漏检面（本轮强口径）
1. **三步及以上循环漏检**
   典型形态：`A → B → C → A → B → C`。当前 `kinds.length === 3` 时直接不命中。
2. **带噪音的双动作循环漏检**
   典型形态：`A → B → A → A → B`、`A → B → pass → A → B`。只要不是严格交替，相邻出现一次重复或插入噪音，当前 alternating 判定就失效。
3. **长窗口循环漏检**
   真实循环如果节拍超过最近 6 条，或中间混入其它可记录动作，样本窗口会把闭环截断，导致 detector 看不出“重复结构”。
4. **ActionLog 缺项导致的完全失明**
   若循环里的关键动作没有被 ActionLog 接纳，detector 看到的只是残缺序列，甚至是空序列；这类场景不是“误判”，而是**根本不在 detector 视野内**。
5. **推进型兜底无法证明根因已消失**
   即使 detector 命中并成功执行 `ADVANCE_PHASE`，也只代表阶段被推进，不代表造成循环的状态源、重入触发点或重复响应源头已经消失；这对应 D8/D9/D39 风险，而不是单纯“多点一次结束回合”能彻底解决。

### DiceThrone 专项：经济动作循环为什么最容易漏
1. **当前 `ACTION_LOG_ALLOWLIST` 不包含 `SELL_CARD` / `DISCARD_CARD` / `UNDO_SELL_CARD`**
   `src/games/dicethrone/game.ts` 顶部 ActionLog 白名单目前只允许 `PLAY_CARD`、`PLAY_UPGRADE_CARD`、`ADVANCE_PHASE`、`SELECT_ABILITY`、`USE_TOKEN`、`SKIP_TOKEN_RESPONSE`、`USE_PURIFY`、`PAY_TO_REMOVE_KNOCKDOWN`、`USE_PASSIVE_ABILITY`、`CONFIRM_ROLL`、`SYS_INTERACTION_RESPOND`。
   这意味着：**卖牌、弃牌、撤回卖牌本身即使真的发生，action-loop detector 也大概率完全看不到。**
2. **formatter 有 `SELL_CARD` 分支，但 allowlist 没放行，属于“死接线”**
   `formatDiceThroneActionEntry()` 已实现 `SELL_CARD` 文案与 `kind='SELL_CARD'` 产出，但被 allowlist 前置门禁挡住；静态上看，这是一个“格式化器支持了，日志入口没开”的断链点。
3. **AI 侧已显式移除 `UNDO_SELL_CARD` 生成，只是上游规避，不是 detector 完整覆盖**
   `src/games/dicethrone/ai.ts` 已明确写明：AI 不再生成 `UNDO_SELL_CARD`，目的是避免 `sell ↔ undo-sell` 卡死。这个改动降低了当前主路径风险，但**不等于 detector 已经有能力审计/识别该类循环**；只是 AI legalActions 先把其中一种循环源头压掉了。
4. **“弃牌↔撤回”在当前静态代码里更应理解为经济动作振荡，而不是存在 `UNDO_DISCARD_CARD`**
   目前 DiceThrone 命令面里没有 `UNDO_DISCARD_CARD`。因此用户观察到的“弃牌↔撤回”更可能是：`DISCARD_CARD / SELL_CARD / UNDO_SELL_CARD / ADVANCE_PHASE` 之间的振荡组合，或“卖牌后撤回、再重新评估弃牌/推进”的往返，而不是专门的“撤回弃牌”命令。
5. **结论：DiceThrone 最危险的盲区不是 detector 判错，而是 detector 根本无数据可判**
   尤其是“弃牌↔卖牌”“卖牌↔撤回卖牌”“弃牌/卖牌/推进交替震荡”这类经济动作循环，当前 watchdog 的 action-loop detector 不能被视为权威兜底。

### 对当前 watchdog 口径的修订结论
- `detectAiActionLoop` 只能算**有限覆盖的兜底信号**，不能算“AI 动作循环检测已完成”。
- 已补上 **active-turn 连续推进** 的兜底（仅 AI seat 生效），避免“推进一步仍停在 AI 回合中间阶段”的假收口；详见「### 4) watchdog 推进策略升级」。
- 对 DiceThrone 来说，当前最大漏检面就是 **ActionLog 未覆盖的经济动作循环**；用户此前提到的“弃牌↔撤回、卖牌↔撤回”类卡死，静态审计上完全成立为高风险盲区。
- `buildOnlineAiRecoveryActionLog()` 上报给反馈接口的也只是尾部 5 条摘要，因此**线上反馈包本身也不能当作完整循环轨迹**；它更适合辅助定位，不足以证明“没有发生动作循环”。
- 若后续要把“AI 不允许卡死”做成真正强口径，动作循环检测不能再只绑在 ActionLog allowlist 上，也不能只识别 repeat / 严格 alternating 两种模式；否则它仍然只是“部分 case 能挡住”的有限兜底。

---

## 修复优先级建议清单（仅方案，不改代码）

> 目的：在“真人绝不被卡死/误伤”的硬目标下，先收口最容易导致死锁与误报的根因。
> 本清单仅提供**优先级与方向**，本轮不改代码、不跑测试。

### P0（必须先做）
1. **Summoner Wars：把本地 UI mode 等待态迁入 `sys.interaction`（真相源统一）**
   - 风险：AI 看不见、本地提示/音效重复、自动反馈无“不能选原因”。
   - 对应文档：`evidence/summonerwars/summonerwars-ai-interaction-audit-2026-04-12.md`（D41 根因）。
2. **action-loop detector 数据源补齐或替代**
   - 当前严重盲区：`SELL_CARD / DISCARD_CARD / UNDO_SELL_CARD` 不进 ActionLog → 经济动作循环不可见。
   - 方向：扩充 ActionLog allowlist 或新增“动作序列”独立信号源。
3. **response-window reopen 与 rollConfirmed 重置链闭环**
   - 必须明确“哪些命令重置 rollConfirmed → 何时可再次开启窗口”的边界；
   - 防止“确认骰面后仍可被卡牌/交互重置导致重复开窗”。

### P1（次高优先级）
4. **自动反馈“无法选择原因”的一致化**
   - 目标：不只在 `sys.interaction` 里有 reason，也要覆盖关键本地路径或迁移到服务端。
5. **watchdog 推进策略的可解释性与抑噪**
   - 目标：避免 human responder 时误触发、“失败提示噪音”重复弹窗。
6. **response-window 的“重复 open”统一去重策略（系统层 + 领域层）**
   - 方向：系统层已做语义去重，但领域层仍需保持序列/签名一致性。

### P2（后续治理）
7. **循环检测模式扩展（>2 步、含噪音、长窗口）**
8. **统一记录“动作循环轨迹”以便线上反馈可复盘**
9. **按游戏维度建立“AI 交互可解矩阵”与最小回归集**

---

## AI 交互可解矩阵：最小回归集（建议清单，仅方案）

> 目的：用“最少且关键的代表性用例”保证 AI 交互链路不会再次卡死。
> 这是**建议清单**，非本轮测试执行记录。

### 全游戏通用（必须至少 1 条覆盖）
1. **response-window 当前 responder 为 human 时，watchdog 不得出手**
2. **隐藏交互卡住 → force-skip 只跳过 AI 当前交互，不误推进真人**
3. **无进展超时 → force-end-turn 必须切回真人回合**
4. **交互取消/空选项必须携带 reason（可诊断原因）**
5. **action-loop 触发与不触发的边界**（至少 repeat / alternating 各一条）

### DiceThrone（最小代表集合）
1. `afterRollConfirmed` 响应窗口：确认骰面 → responderQueue 打开 → 关闭后不重复 reopen
2. `afterCardPlayed` 响应窗口：对手生效卡牌 → responderQueue 打开 → 关闭后不重复 reopen
3. `afterAttackResolved` 响应窗口：伤害结算触发 → responderQueue 打开 → 关闭后不重复 reopen
4. **经济动作循环**：卖牌↔撤回卖牌 / 弃牌↔卖牌 的循环边界（防 action‑loop 盲区）
5. **rollConfirmed 重置链**：骰面已确认后被修改/重掷 → 是否允许 reopen，边界明确

### Summoner Wars（最小代表集合）
1. **迁移后的 sys.interaction 交互**：infection / grab_follow / soul_transfer / mind_capture / ice_shards / feed_beast
2. **仍为本地 mode 的高风险链**：rapid_fire / withdraw / afterMove / magic 二选一
3. **flowHalted 结束阶段**：确认/跳过后能够继续推进，不遗留等待态
4. **自动反馈原因**：本地 mode 迁移后能输出“无法选择原因”

### Smash Up（最小代表集合）
1. **隐藏交互卡住 force-skip**（仍在 AI 回合）
2. **no-progress force-end-turn**（切回真人回合）
3. **afterScoring 链式交互**：窗口/交互并存 → 关闭后只结算一次
4. **responseWindow + interaction 并存**：交互未完成时窗口不应错误关闭

---

## 未覆盖风险汇总（跨游戏一致口径）

> 仅汇总当前仍未收口的高风险点，避免“单文档遗漏导致整体误判已收口”。

### DiceThrone
- 经济动作循环（弃牌/卖牌/撤回）目前 ActionLog 不可见，action-loop detector **可能完全漏检**。
- rollConfirmed 被其他链路重置后再 confirm 的 reopen 边界仍需明确验证。

### Summoner Wars
- 大量等待态仍停留在本地 UI mode（rapid_fire / withdraw / afterMove / magic 二选一）。
- AI 无法读取本地 mode 的“不可选原因”，自动反馈仍不完整。

### Smash Up
- 仍存在历史高风险用例未复跑（skipped 测试清单需恢复）。
- 响应窗口与 afterScoring 组合虽有历史证据，但需在统一审计收口阶段再补新时间戳验证。

---

## 行动项 → 责任链建议清单（仅方案）

> 目的：把“要修什么”明确到“谁负责 + 交付物是什么”。本轮仅提出责任链建议，不改代码。

### 引擎 / 传输层（Platform）
1. **action-loop detector 数据源补齐或替代**
   - 责任：引擎/传输
   - 交付：ActionLog allowlist 扩展或新增“动作序列追踪”信号源；更新检测逻辑说明文档。
2. **watchdog 误报/噪音抑制**
   - 责任：传输层
   - 交付：确保 human responder 时不触发兜底；反馈上报含“不可选原因 + 最终动作轨迹”。

### 游戏层（DiceThrone / SummonerWars / SmashUp）
1. **Summoner Wars：迁移本地 UI mode → sys.interaction**
   - 责任：SummonerWars 游戏层
   - 交付：rapid_fire / withdraw / afterMove / magic 二选一迁移完成；AI 可解性矩阵更新。
2. **DiceThrone：response-window reopen 边界收口**
   - 责任：DiceThrone 游戏层
   - 交付：明确 rollConfirmed 重置链与 reopen 条件；补“经济动作循环”最小回归。
3. **Smash Up：历史 skipped 高风险用例恢复**
   - 责任：SmashUp 游戏层
   - 交付：恢复并标注关键 E2E/单测，补最新时间戳证据。

### 前端 / 体验层
1. **失败提示与恢复提示口径统一**
   - 责任：UI/体验
   - 交付：区分“等待真人响应”与“AI 无解卡死”提示，避免误导。
