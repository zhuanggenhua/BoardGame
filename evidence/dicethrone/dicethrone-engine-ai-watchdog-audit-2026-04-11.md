# DiceThrone 引擎层 AI 决策 / 交互 / 响应窗口 / force-skip 链路审计（2026-04-11）

## 审计范围
- `src/engine/ai/context.ts`
- `src/engine/ai/localRunner.ts`
- `src/engine/transport/onlineAiRecovery.ts`
- `src/engine/transport/server.ts`
- `src/pages/MatchRoom.tsx`
- 入口桥接：`src/pages/onlineAiForceSkip.ts`
- 参考测试：`src/engine/transport/__tests__/server.test.ts`

## 审计目标
1. 梳理 AI 决策 → 命令提交 → 交互/响应窗口 → force-skip / force-end-turn 的全链路。
2. 确认强制兜底不会误伤真人 seat。
3. 评估 `action-loop` 检测与自动反馈上报是否完整。
4. 标出会导致“AI 卡死但兜底失效”或“已恢复但无证据”的结构风险。

## 链路概览

### 1. AI 决策入口（engine/ai）
1. `MatchRoom.tsx` 为每个 AI seat 建立独立 `GameTransportClient`，并在 `resolveNextAiAction(...)` 中优先传入 seat 专属 `visibleStateResolver`。
2. `localRunner.ts` 对每个非 human seat：
   - seat 视角未就绪时直接跳过；
   - 若 seat 只有 `interaction.isBlocked === true`，但没有可见交互、也没有响应窗口，则也直接跳过；
   - 构造 `attemptKey = player + controller + turn + phase + eventStream.nextId + interactionId + responderIndex + legalActionIds`，避免同一批动作重复提交。
3. `context.ts` 先调用各游戏 runtime 的 `buildLegalActions(...)`；只有 runtime 返回空时，才退回引擎通用 fallback。

### 2. 通用 fallback 能力边界
`buildGenericInteractionFallbackActions(...)` 目前只覆盖 `simple-choice`，且只会生成这些“可恢复动作”:
- `skip`
- `done`
- `cancel`
- `__cancel__`
- `__emergency_skip__`
- `multi.min === 0` 时的空选择

这意味着：
- `dt:card-interaction`
- `multistep-choice`
- 其他非 `simple-choice` 交互

**都必须依赖游戏 runtime 正确提供 legal actions**；引擎 fallback 不会自动补救。

### 3. MatchRoom 前端在线 AI 执行与本地兜底
`MatchRoom.tsx` 里有三层前端行为：
1. 正常 AI 决策：`resolveNextAiAction(...)` → `submitOnlineAiResolution(...)`
2. 隐藏交互 4 秒 force-skip：`resolveForceSkippableHiddenAiInteraction(...)`
3. 卡住 8 秒 force-end-turn：`resolveForceEndTurnForStalledAi(...)` → `submitOnlineAiResolutionSequence(...)`

其特征：
- 只对 AI seat 生效，human seat 不会进入这条链。
- 成功/失败只做 toast 提示：`AI 自动跳过` / `AI 已强制结束回合` / `AI 强制结束失败`。
- 失败后会 `resync()` 再给 700ms grace，避免把“其实已经恢复”误报成失败。

### 4. 服务端 authoritative watchdog
`server.ts` 有真正权威的在线 AI watchdog：
1. `runOnlineAiRecoveryTick()` 每 500ms 扫描在线对局；
2. `resolveForceEndTurnForStalledAi(...)` 给出 candidate；
3. 用 `buildAiProgressMarker(...)` + `buildOnlineAiRecoveryFingerprint(...)` 跟踪同一 incident；
4. 超过 8 秒后进入 `runOnlineAiRecoverySequence(...)`；
5. 若成功则上报 `force-end-turn-success`；若多次失败则上报 `force-end-turn-failed`。

### 5. force-skip / force-end-turn 兜底判定顺序
`onlineAiRecovery.ts` 当前顺序是：
1. `pending-damage` → `SKIP_TOKEN_RESPONSE`
2. `visible-interaction` → 优先 force skip，否则 cancel
3. `hidden-interaction` → 优先 force skip，否则 cancel
4. `response-window` → `RESPONSE_PASS`
5. `action-loop` → `ADVANCE_PHASE`
6. `active-turn` → `ADVANCE_PHASE`

### 6. 真人玩家保护
当前逻辑层面，前后端 watchdog 都显式检查 seatController：
- `controller.type === 'human'` 时直接跳过；
- follow-up advance 还会再次确认 `resolveCurrentPlayerId(authoritativeState) === playerId`。

因此**现有实现不会在 seatController 配置正确的前提下误推进真人玩家**。唯一残余风险是：如果 `setupData.seatControllers` 配错，把真人 seat 标成 AI，兜底仍会命中那个 seat；这是配置正确性风险，不是本链路的判断缺陷。

## action-loop 审计结论

### 已实现部分
`onlineAiRecovery.ts` 已实现 action-loop 检测：
- 只在 `main1 / main2 / discard / income / upkeep` 检测；
- 从 `sys.actionLog.entries` 中截取该玩家最近 6 条 `kind`；
- 识别两类：
  - `repeat`：同一种动作重复；
  - `alternating`：两种动作严格交替且都至少出现 2 次。

命中后：
- candidate reason = `action-loop`
- resolution = `ADVANCE_PHASE`
- snapshot 会带 `loopInfo`
- feedback 会带 action log tail

### 不完整之处
1. **仅覆盖 1 动作重复 / 2 动作交替**，不覆盖 3 步及以上循环。
2. **依赖 actionLog.kind**。如果某类命令未进入 action log 或 kind 过于粗糙，会漏检。
3. **不覆盖响应窗口循环**。例如“响应 → 重新触发响应 → 再响应”的循环，如果 action log 不体现为主阶段重复动作，action-loop 看不到。
4. **不覆盖 interaction 内部抖动但 marker 变化很小的伪推进**。
5. **当前未发现专门的 action-loop 单测**；`server.test.ts` 已覆盖 watchdog 成功/失败/真人保护/交互诊断/无解交互反馈，但没有专门断言 `action-loop` 的 repeat / alternating 分支。

### 结论
`action-loop` 已经从“完全没有”升级到“具备主阶段基础兜底”，但**还不能视为完整闭环**。它是必要补位，不是最终收口。

## 自动反馈上报审计结论

### 已完整接入的部分（服务端）
`server.ts` 当前能自动上报三类事件：
- `force-end-turn-success`
- `force-end-turn-failed`
- `unsatisfiable-interaction-auto-skipped`

并且具备：
- `dedupeKey = matchId + playerId + incidentKind + reason + progressMarker`
- cooldown 去重
- `stateSnapshot`
- `actionLog`
- `clientContext`
- `errorContext`

### “为什么无法选择”是否有带上
**有一部分，而且比之前完整很多，但还不是完整决策解释。**

当前 snapshot / unsat feedback 已能携带：
- `simple-choice`
  - `empty-options`
  - `all-options-disabled`
  - `min-selection-unreachable`
- `dt:card-interaction`
  - 无目标玩家
  - 需要状态但没人有状态
  - `selectTargetStatus` 缺来源状态/缺可转移目标
- `seatSelectability / sharedSelectability`
  - 总选项数
  - enabled/disabled 数量
  - disabled / enabled option ids
  - selectionState

### 不完整之处
1. **MatchRoom 前端兜底只 toast，不上报。**
   - 如果前端 4 秒/8 秒先恢复成功，服务端 watchdog 可能永远来不及上报。
   - 这意味着“用户没再卡死”与“系统已留下可诊断证据”不是同一件事。
2. **反馈是状态诊断，不是 AI 决策 trace。**
   现在没有把这些内容随 watchdog feedback 一起上报：
   - 当时的 `legalActions`
   - AI 最终选择的 `actionId`
   - `reasoningSummary`
   - `providerMetadata.contributions/evaluations`
3. `server.ts` 虽然在训练样本里会重新构建 `legalActions`，但 watchdog feedback payload 没带这些解释信息。
4. 前端 force-skip / force-end-turn 成功路径没有统一 incident id，上游很难把“用户端 toast 成功”和“服务端后来又恢复/又失败”拼成同一条事件。

### 结论
- **服务端自动反馈：状态诊断层面基本完整。**
- **全链路自动反馈：还不完整。**
  最大缺口就是：**前端先恢复成功时，没有同等级自动上报；同时 watchdog 上报不包含 AI 决策解释。**

## 关键风险点

| 风险 | 等级 | 说明 |
|---|---|---|
| runtime legal actions 漏生成为空时，仅 simple-choice 有引擎 fallback | 高 | `dt:card-interaction` / 复杂交互若 runtime 漏接，AI 直接失去可行动作，watchdog 只能靠 cancel/pass/advance 止血。 |
| seat 专属视角未就绪会被 localRunner 静默跳过 | 中 | `visibleStateResolver` 返回空时不会退回共享视角，这是对的，但会造成“AI 没动作且日志不明显”。 |
| response-window 兜底只有 `RESPONSE_PASS` | 中 | 对“必须先确认/先清理再 pass”的复杂响应链，可能只是推进表象，未必真正解根因。 |
| action-loop 覆盖范围有限 | 高 | 目前只抓主阶段 repeat / alternating；对响应循环、三步循环、未记 actionLog 的循环无能为力。 |
| progressMarker 粒度偏粗 | 中 | marker 只看 turn/phase/eventStream/interationId/responderIndex/currentPlayerId，不含 legalActions / actionLog tail。某些伪推进仍可能被视作“有变化”。 |
| 前端 MatchRoom 与服务端 watchdog 职责重叠 | 高 | 两边都能自动恢复，但只有服务端会系统上报；前端先恢复成功会留下观测缺口。 |
| 反馈没有 AI 决策解释 | 中 | 已知道“为什么不能选”，但还不知道“AI 为什么选了这个/为什么持续选同一类动作”。 |

## 已存在的验证证据
- `src/engine/transport/__tests__/server.test.ts` 已覆盖：
  - watchdog 成功恢复
  - 真人玩家 guard
  - 失败反馈去重冷却
  - 自动反馈交互可选性诊断
  - `dt:card-interaction` 无解 cancel reason
  - `unsatisfiable-interaction-auto-skipped`
- **未发现 action-loop 专项测试**。

## 审计命中维度（D1-D49）
- `D7 隐式依赖`：AI 是否依赖 runtime 正确产出 legal actions
- `D10 元数据一致性`：actionLog.kind / interaction selectability 与 watchdog 判定是否一致
- `D20 可观测性`：feedback snapshot / action log / cooldown / dedupe 是否完整
- `D21 重复触发`：repeat / alternating / no_progress / loop_detected
- `D24 交互链完整性`：AI 视角 state → decision → command → authoritative recovery
- `D39 流程/交互卡死`：force-skip、force-end-turn、response pass、pending damage skip
- `D41 系统职责重叠`：MatchRoom 与 server 双层 watchdog
- `D44 测试反模式`：当前 watchdog 有测试，但 action-loop 专项覆盖仍缺

## 最终结论
1. **不会误伤真人玩家**：在 `seatControllers` 配置正确的前提下，当前 force-skip / force-end-turn 只命中 AI seat。
2. **当前兜底“有效但不完整”**：
   - pending-damage / visible/hidden interaction / response-window / active-turn 已有基础止血；
   - action-loop 已补上，但还不是“任何循环都能识别”。
3. **自动反馈“服务端较完整、全链路不完整”**：
   - 服务端已经能上报“无解交互为什么不能选”；
   - 但 MatchRoom 本地自动恢复没有等价上报；
   - feedback 仍缺 AI 决策解释（legal actions / chosen action / scorer 贡献）。
4. **如果目标是“AI 绝不再静默卡死”**，下一步最该补的是：
   - action-loop 专项测试；
   - 响应窗口循环检测；
   - 前端自动恢复事件也接入统一 feedback reporter；
   - watchdog snapshot 增加 legalActions / chosenAction / reasoningSummary。
