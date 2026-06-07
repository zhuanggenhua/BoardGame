# SmashUp watchdog active-turn ADVANCE_PHASE 失败收口（2026-05-17）

## 对象

- `69fff887316dbddba433aafc`
  - `matchId = OXT1F8AirUQ`
  - 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`
- `69fdd1d03b0e6d6909dd8262`
  - `matchId = xiWqKMhbpaQ`
  - 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`

## 现场事实

- 两条反馈的 `stateSnapshot` 共同特征：
  - `gameId = smashup`
  - `phase = playCards`
  - `reason = active-turn`
  - `interaction = null`
  - `responseWindow = null`
  - `legalActions.total = 1`
  - 唯一 legal action 为 `advance-phase:playCards:<playerId>`，命令类型只有 `ADVANCE_PHASE`
- `aiDecisionPreview` 也明确显示 watchdog 看到的最佳动作就是 `ADVANCE_PHASE`，不是“无动作”或“看不到 seat overlay”。

## 根因

- watchdog 主循环会先尝试 `tryRecoverOnlineAiWithLegalAction(...)`。
- 若这一步里的 legal action 已经执行到 `ADVANCE_PHASE`，但命令本身失败，旧逻辑仍会落回 `currentCandidate.resolution.action.commands[0]` 再打一遍同一个 `ADVANCE_PHASE`。
- 结果：
  - 没有得到更精确的失败诊断；
  - 自动反馈 reason 被吞成裸 `command_failed`；
  - 线上只留下“follow-up-advance command_failed”，看不出是 legal-action 自己先失败。

## 本轮修改

- 文件：[server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
- 调整：
  - 当 `tryRecoverOnlineAiWithLegalAction(...)` 返回 `legal-action-command-failed` 时，watchdog 立即按该结果上报失败；
  - 不再对同一条失败的 legal action 命令重复走 fallback。
- 结果口径：
  - 从旧的 `active-turn:follow-up-advance:command_failed`
  - 收敛为 `active-turn:follow-up-advance:legal_action_command_failed:ADVANCE_PHASE:<真实失败原因>`

## 回归测试

- 文件：[server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
- 新增用例：
  - `online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed`
- 我实际验证到的行为：
  - `executeCommandInternal('ADVANCE_PHASE')` 只被调用 1 次；
  - 自动反馈 reason 为
    `active-turn:follow-up-advance:legal_action_command_failed:ADVANCE_PHASE:pipeline_error: test advance denied`
  - 不再退化成裸 `command_failed`。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因|online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed"`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"`
- `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts`

## 结论

- 这两条 open 单暴露的是 watchdog 失败诊断口径过粗，而不是“已经知道 legal action 失败后还应继续重打一遍同命令”。
- 当前修复已把这类 active-turn / playCards / `ADVANCE_PHASE` 失败明确归类到 `legal_action_command_failed`，便于后续继续定位真实领域拒绝原因，也避免同命令二次重试制造误导性 `command_failed`。

## 2026-05-19 剩余 reason 面复核

本轮继续把 `server.ts` 里残留的 `candidate.reason` 读取点逐项分成“行为分支”和“纯诊断/指纹”两类，避免后续再把 `response-window` / `response-loop` / `manual-response-window` 混成同一个问题。

- **仍会影响行为的点**：已经锁在
  - `tryRecoverOnlineAiWithLegalAction(...)` 的 emergency overlay fallback 判定；
  - `buildOnlineAiRecoveryFingerprint(...)` 的 tracker/fingerprint 归类；
  - `hasOnlineAiRecoveryResolved(...)` 的恢复完成判定。
- **本轮结论：这些行为点里，`response-loop` / `response-window` provenance 已按最终 tracker 语义收口，没有再发现新的 fallback 分支 bug。**
- **只属于指纹/诊断的点**：
  - `manual-response-window` 只出现在 `resolveManualForceEndAiPhase(...)` 生成的 `fingerprintHint/attemptKey` 中；
  - 它不会把 `reason` 变成新的枚举分支，`reason` 仍是 `response-window`；
  - `unsatisfiable-interaction-auto-skipped` 走的是独立 `incidentKind` 上报链，不参与 `response-window/response-loop` 的 fallback 判定。

### 新增锁定证据

- 测试文件：[onlineAiRecovery-gameover.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts)
- 新增用例：
  - `手动 response-window 只应把 manual-response-window 写进 fingerprint，不应变成新的 reason 分支`
- 我实际要锁住的口径：
  - `resolveManualForceEndAiPhase(...)` 返回的 `reason` 仍是 `response-window`
  - `fingerprintHint = manual-response-window:1:afterCardPlayed:card-surprise`
  - `attemptKey` 里可以带 `manual-response-window:*`，但它只服务于人工强制恢复的指纹留档

### 当前残余

- 这轮没有再发现新的 watchdog 行为 bug；剩余 `candidate.reason` 读取点里，仍值得继续关注的是**诊断文本是否足够可读**，不是 fallback/恢复路径是否走错。
- 后续如果再出现“线上反馈看不出到底是哪类窗口/哪条命令失败”，优先补的是 evidence/日志粒度，而不是再改 `reason` 行为分支。

### `server.ts` 剩余读点逐条归类

以下归类专门回答“剩余 `candidate.reason` 读点里，哪些还会改变行为，哪些只是诊断文本”：

- **纯诊断 / 反馈拼接，不改变恢复行为**
  - `1885`：`online-ai-watchdog recovered stalled AI` 的成功日志字段，只负责把原始 `candidate.reason` 打进日志。
  - `1920`：`force-end-turn-success` feedback 的 `reportedReason` 选择逻辑；只决定上报文案是沿用最后一次真正执行的 forced reason，还是沿用起始 candidate。
  - `1987`：`force-end-turn-failed` feedback 的 reason 字符串拼接；只影响反馈可读性。
  - `2044` / `2053`：`buildOnlineAiRecoveryStateSnapshot(...)` 里的 snapshot 字段；只决定 evidence/反馈里展示什么 reason，以及 `action-loop` 是否附带 loop 细节。
  - `2199`：`buildOnlineAiRecoveryActionLog(...)` 传给诊断 action log 的 reason 字段；只服务留档。
  - `2724`：`online-ai-watchdog retrying legal-action with emergency playerView` 的 warn 日志字段；不参与判定。
  - `2849`：`legal-action-recovered` feedback 的 resolved reason 拼接；只说明“哪个 candidate reason 下，哪条 legal action 把状态推进了”。
  - `2874`：`reportedAction.candidateReason` 诊断字段；只服务后续 evidence / reporter 消费。

- **仍会影响行为，需要继续当 shared contract 审**
  - `2251` / `2262-2336`：`buildOnlineAiRecoveryFingerprint(...)`。它决定 tracker key / blocker fingerprint 的归类方式，直接影响“这是旧 incident 继续失败，还是新窗口/新交互已漂移，应丢掉旧 tracker”。
  - `2357-2381`：`hasOnlineAiRecoveryResolved(...)`。它决定 watchdog 是否认为这次恢复已经真正收口，直接影响 tracker 清理与后续是否继续接管。
  - `2711`：`shouldUseOnlineAiEmergencyOverlayFallback(candidate.reason)`。这是 legal-action recovery 在 private overlay stale/missing 时要不要切 emergency playerView 重试的真实行为开关。

### 行为点最终结论

- `2251 / 2262-2336`：`response-window` 与 `response-loop` 当前都按窗口/队列指纹归类，已有 response-window / response-loop fingerprint drift 回归，没再看到 tracker 误黏在旧 incident 上。
- `2357-2381`：`visible-interaction` / `hidden-interaction` / `response-window` / `response-loop` 的 resolved 判定都已经按“真实当前交互/窗口是否还属于该 AI”收口，没有发现“状态已换新但仍沿旧 reason 继续报失败”的新洞。
- `2711`：当前 emergency overlay fallback 白名单仍只覆盖 `response-window`、`active-turn`、`active-turn-legal-only`、`seat-legal-only`、`visible-interaction`、`hidden-interaction`。本轮没有发现 `response-loop` 因未进白名单而产生新的真实恢复失败；现有 `response-loop` 风险仍主要由 fingerprint/resolved 合同约束，而不是 fallback 分支漏判。

## 2026-05-20 继续收紧 visible-interaction 语义指纹

- 这轮继续往 shared transport 下钻，不回扫旧玩法对象。
- 当前 worktree 的真缺口：
  - `resolveForceEndTurnForStalledAi()` 给自动 `visible-interaction / hidden-interaction` 候选生成的 suffix 旧口径只跟 `interactionId` 走。
  - `server.ts` 的 `buildOnlineAiRecoveryFingerprint()` 对 `simple-choice` 只看 `sourceId/title/minCount/optionCount`，对 `compare-roll-choice` 只看粗 `interactionId`。
  - 所以同一个 `interactionId/sourceId` 壳子下，只要 `simple-choice option.value` 或 `compare-roll-choice confirmValue` 变了，watchdog 仍可能沿旧 tracker 继续。
- 本轮修改：
  - [onlineAiRecovery.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/onlineAiRecovery.ts) 新增 `buildInteractionRecoveryFingerprintHint(...)`，把 `simple-choice option.value` 与 `compare-roll-choice confirmValue` 并入自动 candidate 的 `fingerprintHint / attemptKey`。
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts) 的 `buildOnlineAiRecoveryFingerprint()` 对 `visible/hidden interaction` 改为复用同一 semantic fingerprint，不再退回粗 `interactionId / optionCount`。
- 新增与邻近验证：
  - [onlineAiRecovery-gameover.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts)
    - `可见 simple-choice 在同 interactionId 下若 option value 漂移，watchdog 的 attemptKey 也必须跟着变化`
    - `可见 compare-roll-choice 在同 interactionId 下若 confirmValue 漂移，watchdog 的 attemptKey 也必须跟着变化`
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 option id/disabled 相同但 value 漂移时，也必须变化`
    - `buildOnlineAiRecoveryFingerprint 在 compare-roll-choice 的 interactionId/sourceId 相同但 confirmValue 漂移时，也必须变化`
    - `online AI watchdog 在 visible-interaction 候选 fingerprint 漂移到新的 compare-roll current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败`
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "visible simple-choice.*value 漂移|compare-roll-choice.*confirmValue 漂移|visible-interaction 候选 fingerprint 漂移到新的 compare-roll current|手动 response-window 只应把 manual-response-window 写进 fingerprint"` => `2 files passed, 5 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "visible-interaction 候选 fingerprint 漂移到新的 compare-roll current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败"` => `1 file passed, 1 passed`
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/server.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 结论：
  - 这次是 shared transport 真修复，不是又靠 state 文案补口径。
  - 同时也解释了为什么之前会“像死循环”：长期 JSON 曾提前承认过这类 semantic fingerprint 已闭合，但当前仓库代码并没有完全落地；本轮已经把这条断层补齐。

## 2026-05-20 继续收紧 `dt:defender-choice` 语义指纹

- 这轮继续沿 `resolveOnlineAiRecoveryCandidate()` / `buildOnlineAiRecoveryFingerprint()` 主线往下钻，不回扫已闭的对象级玩法链。
- 新发现的 live seam：
  - DiceThrone 的 `dt:defender-choice` 仍落在 `buildInteractionRecoveryFingerprintHint(...)` 的 generic fallback 上；
  - 旧口径只会生成 `interaction:${playerId}:${phase}:${kind}:${interactionId}`，没有把 `sourceId`、攻击者、目标点数或候选 defender 集合带进自动 `force-end-turn` 的语义指纹；
  - 这意味着同一 `interactionId` 壳子下只要 `sourceId` 漂移，watchdog 仍可能沿旧 tracker 继续，而不是把它当成新的 visible interaction incident。
- 本轮修改：
  - [onlineAiRecovery.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/onlineAiRecovery.ts)
    - 为 `dt:defender-choice` 增加专用 fingerprint：
      `interaction:${playerId}:${phase}:dt:defender-choice:${sourceId}:${attackerId}:${targetRollValue}:${optionSignature}:${interactionId}`
    - 其中 `optionSignature` 显式带入 `playerId/customId/disabled`，避免 defender 候选集变化时继续复用旧 incident。
- 新增验证：
  - [onlineAiRecovery-gameover.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts)
    - `可见 dt:defender-choice 在同 interactionId 下若 sourceId 漂移，watchdog 的 attemptKey 也必须跟着变化`
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `buildOnlineAiRecoveryFingerprint 在 dt:defender-choice 的 interactionId/sourceId 相同但 sourceId 漂移时，也必须变化`
    - `online AI watchdog 在 dt:defender-choice 候选 fingerprint 漂移到新的 sourceId 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败`
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "dt:defender-choice|compare-roll-choice|simple-choice"` => `1 file passed, 5 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "dt:defender-choice 的 interactionId/sourceId 相同但 sourceId 漂移|dt:defender-choice 候选 fingerprint 漂移到新的 sourceId"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 结论：
  - `dt:defender-choice` 这条 live prompt kind 不再停在 generic visible-interaction fallback；
  - 这次收掉的是 shared transport semantic fingerprint 的新残口，不外推 `response-window / manual-response-window / overlay resync` 其余 caller provenance 已全部完成。

## 2026-05-20 继续收紧 overlay resync cooldown provenance

- 这轮继续顺着 shared transport caller provenance 往下看时，发现当前仓库的 `maybeTriggerOnlineAiOverlayResync()` 仍只按 `matchID:playerId` 做冷却去重。
- 这会带来一个真实缺口：
  - 同一 seat 即使 `blockedKey` 不变，但 `progressMarker` 已经漂移到新的现场，旧冷却也会把新的 overlay resync 一并吞掉；
  - 长期状态此前已经把这格写成“应按 `blockedKey + progressMarker` 分隔”，但当前代码并没有真正落地。
- 本轮修改：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
    - `maybeTriggerOnlineAiOverlayResync(...)` 的 cooldown key 现已收紧为
      `${matchID}:${playerId}:${blockedKey}:${progressMarker}`
    - legal-action blocked 分支在触发 overlay resync 时，也显式把 `buildAiProgressMarker(match.state)` 传进 helper。
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `online AI watchdog 在 blockedKey 相同但 progressMarker 漂移时，应允许再次触发 overlay resync，而不是被旧冷却一并吞掉`
    - 并复跑已有的 `online AI watchdog 触发 overlay resync 后应按冷却去重，避免连续广播风暴`
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "overlay resync 后应按冷却去重|blockedKey 相同但 progressMarker 漂移时，应允许再次触发 overlay resync"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 结论：
  - overlay resync 冷却不再把“同 seat 的新现场”误吞成旧 blocked incident；
  - 这次补的是 shared transport helper 粒度的真落地，不外推 `response-window / manual-response-window` 其余 forced-command caller seam 已全部完成。

## 2026-05-20 继续收紧 manual visible/hidden interaction attemptKey provenance

- 这轮继续对齐长期状态时，又抓到一条“状态说已补、当前代码没落地”的 seam：
  - `resolveManualForceEndAiPhase()` 里的 `manual-visible-interaction` 与 `manual-hidden-interaction` 旧逻辑仍只按 `interactionId` 生成 `attemptKey`；
  - 也就是说，同一手动强制恢复链里如果 `sourceId` 已漂移到新的可见/私有 prompt，前端去重键和重试键仍会误沿用旧 incident。
- 本轮修改：
  - [onlineAiRecovery.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/onlineAiRecovery.ts)
    - `manual-visible-interaction` 与 `manual-hidden-interaction` 现已显式复用 `buildInteractionRecoveryFingerprintHint(...)`
    - `fingerprintHint` 分别记为
      - `manual-visible-interaction:${semanticHint}`
      - `manual-hidden-interaction:${semanticHint}`
    - `attemptKey` suffix 也同步改为 `${fingerprintHint}:${interactionId}`，不再只靠粗 `interactionId`
- 新增验证：
  - [onlineAiRecovery-gameover.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts)
    - `手动 visible-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 semantic fingerprint 变化`
    - `手动 hidden-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 semantic fingerprint 变化`
    - 与既有 `手动 response-window 只应把 manual-response-window 写进 fingerprint，不应变成新的 reason 分支` 同组复跑
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "手动 visible-interaction|手动 hidden-interaction|手动 response-window"` => `1 file passed, 3 passed`
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts` => `0 errors / 0 warnings`
- 结论：
  - 手动 visible/hidden force-end-turn 不再停留在粗 `interactionId` 级别；
  - 这次补的是手动恢复链本身的 semantic fingerprint 真落地，不外推 `manual-response-window` 或自动 watchdog 主线已经全量收口。

## 2026-05-20 当前 goal 对齐复验

- 这轮不是新开一条玩法线，而是回到当前 active `goal` 真正对应的 shared transport 主线做最小复验。
- 我实际复跑：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "response-window|手动 visible-interaction|手动 hidden-interaction"` => `1 file passed, 5 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "response-window 的 source/responder 相同但 window id 漂移|response-window 候选 fingerprint 漂移到新的窗口 current|response-loop 的 type/source/queue 相同但 window id 漂移|response-loop 的 window id/queue 相同但 sourceId 漂移|response-loop 的 window/source 相同但当前 responder 漂移"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/server.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - `manual-response-window / response-window` 这轮 helper 对齐当前已稳定转绿；
  - 当前 remaining seam 不在这几个已复验的 helper/gate 上，而应继续下钻 `resolveOnlineAiRecoveryCandidate()`、`hasOnlineAiRecoveryResolved()`、`tryRecoverOnlineAiWithLegalAction()` 与 overlay resync / emergency fallback caller；
  - 这也解释了为什么之前会有“像死循环”的观感：旧 `goal.objective` 仍停在 The Spy waiting overlay 文案，长期 JSON 的历史 `next_actions` 又堆了很多“不要回扫”提醒，导致真实主线和表面文案长期错位。

## 2026-05-20 补 response-loop 离线 immediate takeover

- 继续顺着 `response-window / response-loop` 家族往下查时，又抓到一条真 seam：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts) 的 `resolveOnlineAiRecoveryTimeoutMs()` 旧逻辑只把 `active-turn / response-window / visible-interaction / hidden-interaction` 视为“AI seat 已离线时应立即接管”的情况；
  - 但已经进入 hard-close 语义的 `response-loop` 反而没被算进去，理论上会落成“先等 watchdog timeout，再强制关窗”的额外停顿。
- 本轮修改：
  - `resolveOnlineAiRecoveryTimeoutMs()` 已补 `candidate.reason === 'response-loop'`，使离线 AI seat 在 `response-loop` 下也走 `timeout=0` 的立即接管口径。
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `online AI watchdog 在 remote-ai seat 已离线时也应立即接管 response-loop，而不是继续等待宿主页恢复`
  - 与既有 `response-window` 离线立即接管用例同组复跑：
    - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "已离线时应立即接管 response-window|已离线时也应立即接管 response-loop"` => `1 file passed, 2 passed`
    - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - `response-loop` 不再停在“response-window 已能离线立即接管，但 hard-close 轨道自己还要先等 timeout”的 caller 缝上；
  - 这次收掉的是 shared transport timeout gate 的单点遗漏，不外推 `response-window / response-loop` 其余 caller provenance 已全部完成。

## 2026-05-20 补 response-loop completion notice

- 继续清 `response-window / response-loop` 家族的前端收口口径时，又抓到一条用户面遗漏：
  - [onlineAiForceSkip.ts](/D:/gongzuo/webgame/BoardGame/src/pages/onlineAiForceSkip.ts) 里的 `resolveOnlineAiAutoRecoveryCompletionNotice()` 旧逻辑只把 `hidden-interaction / visible-interaction / response-window` 视为“AI 响应超时”会弹出自动跳过提示的族群；
  - 但 `response-loop` 已经是 hard-close 语义，成功收口后前端不该比 `response-window` 少这层完成提示。
- 本轮修改：
  - `resolveOnlineAiAutoRecoveryCompletionNotice()` 已把 `response-loop` 纳入同一提示族群。
- 新增验证：
  - [matchSeatValidation.test.ts](/D:/gongzuo/webgame/BoardGame/src/pages/__tests__/matchSeatValidation.test.ts)
    - `response-loop hard-close 收口后若仍停留在 AI 流程，也应显示自动跳过提示`
    - 并与既有 `resolveOnlineAiAutoRecoveryCompletionNotice` / tutorial 路由重建用例同组复跑
  - 验证命令：
    - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "resolveOnlineAiAutoRecoveryCompletionNotice|response-loop hard-close 收口后若仍停留在 AI 流程，也应显示自动跳过提示|切换教程路由时会强制重建 MatchRoom"` => `1 file passed, 5 passed`
    - `npx eslint src/pages/onlineAiForceSkip.ts src/pages/__tests__/matchSeatValidation.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - `response-loop` 的前端完成提示已与 `response-window` 对齐，不会在 hard-close 收口后静默；
  - 这次补的是用户面 completion notice 的单点遗漏，不外推 `response-window / response-loop` 其余 transport/caller seam 已全部完成。

## 2026-05-20 收紧 MatchRoom confirmed override 生命周期

- 继续沿 shared transport / playerView 主线往下查时，又抓到一条更靠近用户观感“像死循环”的真 seam：
  - [MatchRoom.tsx](/D:/gongzuo/webgame/BoardGame/src/pages/MatchRoom.tsx) 里 AI seat 的 confirmed bridge 旧逻辑虽然会在 `onConfirmed` 时 staging `seatStateOverride`，但在后续 `onStateUpdate` 时会无条件清 override；
  - 同时 `resolveOnlineAiEffectiveSeatState()` 旧逻辑只要看到 override 存在，就永远优先返回 override，不会判断 latest seat state 是否已经追平；
  - 这意味着“confirmed 只作为一拍桥接”的合同并没有真正落到读取层和清理层，仍可能把 latest 已追平的 seat state 继续阴影成旧 override。
- 本轮修改：
  - [MatchRoom.tsx](/D:/gongzuo/webgame/BoardGame/src/pages/MatchRoom.tsx)
    - 新增 `shouldRetainOnlineAiSeatOverrideAfterLatestState(...)`
    - `resolveOnlineAiEffectiveSeatState()` 改为：latest seat state 已追平 override 时，直接退回 latest；只有 latest 未追平时才继续保留 override
    - AI seat `onStateUpdate` 改为复用同一 gate，不再对 override 做无条件清理
- 新增验证：
  - [matchSeatValidation.test.ts](/D:/gongzuo/webgame/BoardGame/src/pages/__tests__/matchSeatValidation.test.ts)
    - `latest seat state 已追平 confirmed override 时，不应继续沿用 override 阴影状态`
    - `latest seat state 尚未追平 confirmed override 时，必须继续保留 override 作为桥接态`
    - 与既有 `staged override 只应作为 confirmed 到 state update 之间的一拍桥接`、`response-loop hard-close 收口后若仍停留在 AI 流程，也应显示自动跳过提示` 同组复跑
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "staged override 只应作为 confirmed 到 state update 之间的一拍桥接|latest seat state 已追平 confirmed override 时，不应继续沿用 override 阴影状态|latest seat state 尚未追平 confirmed override 时，必须继续保留 override 作为桥接态|response-loop hard-close 收口后若仍停留在 AI 流程，也应显示自动跳过提示"` => `1 file passed, 4 passed`
  - `npx eslint src/pages/MatchRoom.tsx src/pages/__tests__/matchSeatValidation.test.ts src/pages/onlineAiForceSkip.ts` => 无新增 errors；`MatchRoom.tsx` 仅保留既有 `react-refresh/only-export-components` warnings
- 本轮结论：
  - confirmed override 现在不再被当成长期稳定数据源，而是真正收成“latest 未追平时保留、追平后立即退回 latest”；
  - 这次补的是 `MatchRoom` seat state bridge 的生命周期 seam，不外推更深的 `resolveOnlineAiRecoveryCandidate()` / `hasOnlineAiRecoveryResolved()` / `tryRecoverOnlineAiWithLegalAction()` caller provenance 已完成。

## 2026-05-20 收紧 response-loop continuity

- 继续往 shared transport 主线下钻时，又抓到一条会直接制造“看起来像在反复重试”的 continuity seam：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts) 的 `resolveOnlineAiRecoveryCandidate()` 旧逻辑只会在 `currentTracker.key` 还是 `response-window`、且 `failureCount > 0` 时升级成 `response-loop`；
  - 一旦 tracker 已经进入同一 incident 的 `response-loop` key，下一拍重新求 candidate 仍会回到 `response-window`，等于 hard-close 轨道没有被显式续接。
- 本轮修改：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
    - `resolveOnlineAiRecoveryCandidate()` 现在会同时识别
      - `response-window tracker key + failureCount > 0`
      - `response-loop tracker key`
    - 只要当前 tracker 已经是同一 incident 的 `response-loop` key，且队列里没有 human responder，就继续返回 `response-loop`，不再退回 `response-window`
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - 新增 `resolveOnlineAiRecoveryCandidate 在 tracker 已进入同一 incident 的 response-loop key 后，仍应继续返回 response-loop，而不是退回 response-window`
    - 并与既有
      - `online AI watchdog 响应循环时应强制关闭响应窗口`
      - `online AI watchdog 在 response-loop 候选 fingerprint 漂移到新的窗口 current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败`
      同组复跑
  - 同时修正既有 `response-loop 候选 fingerprint 漂移` 用例的旧假设：当前实现已把 `windowId` 并入 `response-loop` fingerprint，因此该测试的旧 tracker key / attemptKey 也同步补上 `windowId`，避免继续拿过期合同误报红灯
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "resolveOnlineAiRecoveryCandidate 在 tracker 已进入同一 incident 的 response-loop key 后，仍应继续返回 response-loop，而不是退回 response-window|online AI watchdog 响应循环时应强制关闭响应窗口|online AI watchdog 在 response-loop 候选 fingerprint 漂移到新的窗口 current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败"` => `1 file passed, 3 passed`
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - `response-loop` 现在不再是“第一次能升级成 hard-close，但下一拍又掉回 response-window”的半截轨道；
  - 这次补的是 `resolveOnlineAiRecoveryCandidate()` 的 continuity seam，不外推 `hasOnlineAiRecoveryResolved()` / `tryRecoverOnlineAiWithLegalAction()` 的其余 caller provenance 已完成。

## 2026-05-20 收紧 legalActionOnly resolved 语义

- 继续沿 shared transport / playerView 主线下钻时，又抓到一条更靠近“为什么像卡住又自己说收口”的 seam：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts) 里 `hasOnlineAiRecoveryResolved()` 对 `candidate.legalActionOnly === true` 旧逻辑只会再查 `resolveOnlineAiLegalActionOnlyCandidate()`；
  - 这会让现场一旦已经切成同一 AI 的 `response-window / active-turn / visible-interaction / hidden-interaction`，就因为 legal-only 分支本身消失而被误判成 resolved。
- 本轮修改：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
    - `hasOnlineAiRecoveryResolved()` 的 legalActionOnly 分支改为直接复查完整 `resolveOnlineAiRecoveryCandidate()`
    - 只要当前仍是同一 AI 的任意 recovery family，就继续视为 unresolved
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `online AI watchdog 的 seat-legal-only resolved 判定在同一 AI 仍处于 response-window 时，不应提前判定为 resolved`
    - 与既有 `resolveOnlineAiRecoveryCandidate 在 tracker 已进入同一 incident 的 response-loop key 后，仍应继续返回 response-loop，而不是退回 response-window` 同组复跑
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 seat-legal-only resolved 判定在同一 AI 仍处于 response-window 时，不应提前判定为 resolved|resolveOnlineAiRecoveryCandidate 在 tracker 已进入同一 incident 的 response-loop key 后，仍应继续返回 response-loop，而不是退回 response-window"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - `legalActionOnly` 现在不再因为 legal-only 分支短暂消失就误报 resolved；
  - 这次补的是 `hasOnlineAiRecoveryResolved()` 的 sibling-family seam，不外推 `tryRecoverOnlineAiWithLegalAction()` / overlay resync 的其余 caller provenance 已完成。

## 2026-05-20 补 response-loop 的 emergency playerView fallback

- 继续往 `tryRecoverOnlineAiWithLegalAction()` 的 caller seam 下钻时，又抓到一条此前只靠 `response-window` 家族旁证的漏口：
  - [onlineAiRecovery.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/onlineAiRecovery.ts) 里的 `ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS` 旧逻辑没有把 `response-loop` 纳入白名单；
  - 这意味着 hard-close 轨道如果遇到 `stale-private-overlay / missing-private-overlay`，不会像 `response-window` 一样走 emergency playerView 重试。
- 本轮修改：
  - [onlineAiRecovery.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/onlineAiRecovery.ts)
    - `ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS` 已补 `response-loop`
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `tryRecoverOnlineAiWithLegalAction 在 response-loop 遇到 private overlay stale 时，也应使用 emergency playerView 重试响应动作`
    - `tryRecoverOnlineAiWithLegalAction 在 response-loop 遇到 missing private overlay 时，也应使用 emergency playerView 重试响应动作`
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "tryRecoverOnlineAiWithLegalAction 在 response-loop 遇到 private overlay stale 时，也应使用 emergency playerView 重试响应动作|tryRecoverOnlineAiWithLegalAction 在 response-loop 遇到 missing private overlay 时，也应使用 emergency playerView 重试响应动作"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - `response-loop` 现在不再停在“response-window 会走 emergency playerView，但 hard-close 轨道自己不会”的 caller 漏口上；
  - 这次补的是 `tryRecoverOnlineAiWithLegalAction()` 的 fallback 白名单 seam，不外推其余 feedback / overlay-resync caller 已全部完成。

## 2026-05-20 补 missing-visible-state 的 failure provenance

- 继续沿 `shared transport / playerView / caller provenance / completion audit` 主线下钻时，又抓到一条不该再靠 reason 字段旁证的细缝：
  - `active-turn-legal-only` 在 visible state 缺失时，`feedback.reason` 已经能写成 `missing_visible_state`；
  - 但 [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts) 旧 `buildOnlineAiRecoveryStateSnapshot()` / `buildOnlineAiRecoveryActionLog()` 仍只按 candidate/tracker 生成 `blockerFingerprint`，结果 `stateSnapshot/actionLog.blockerFingerprint` 只剩 `active-turn-legal-only:1:targetingRoll`，没有把这次失败来源本身带出来。
- 本轮修改：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
    - `buildOnlineAiRecoveryStateSnapshot()` 与 `buildOnlineAiRecoveryActionLog()` 新增可选 `failureReason`
    - `resolveOnlineAiRecoveryFeedbackFingerprint()` 在 `failureReason === 'missing_visible_state'` 时，会给 base fingerprint 追加 `:missing-visible-state`
    - `handleOnlineAiRecoveryFailure()` 回报 `force-end-turn-failed` 时，显式把当前 failure reason 传进 snapshot/actionLog 生成链
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `online AI watchdog 在 AI active 的 targetingRoll 且 visible state 缺失时，应上报 missing_visible_state 而不是泛化失败`
    - 与既有 `online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE` 同组复跑
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE|online AI watchdog 在 AI active 的 targetingRoll 且 visible state 缺失时，应上报 missing_visible_state 而不是泛化失败"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - 这次不是又回到“死循环”，而是把一个之前只在 `feedback.reason` 上可见、但没进 diagnostics provenance 的 failure seam 补到了 `stateSnapshot/actionLog`；
  - `missing-visible-state` 现在不再只是日志里看得到的 reason，而会直接体现在自动反馈诊断指纹里；
  - 这次补的是 legalActionOnly failure diagnostics 的 provenance 漏口，不外推 `response-window / manual-response-window / generic fallback` caller 主线已全部完成。

## 2026-05-20 补 response-window forced fallback 吞掉 missing-visible-state

- 继续沿 `response-window / manual-response-window / generic fallback` caller seam 下钻时，补出了一条新的真红灯：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts) 新增 `online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress`
  - 旧实现下，这条用例真实失败：`resolveNextAiDispatch()` 先回 `blockedReason='missing-visible-state'`，但 `response-window` 因为不是 legal-only，仍会 fallback 执行 `RESPONSE_PASS`；如果这次 forced 命令没有推进权威态，最后 `handleOnlineAiRecoveryFailure()` 会把失败粗暴记成 `response-window:recover-interaction:no_progress`，把原始 blocker 吞掉。
- 本轮修改：
  - [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)
    - 在 `runOnlineAiRecoverySequence()` 中提取 `blockedFailureReason`
    - 当 `tryRecoverOnlineAiWithLegalAction()` 先返回 `blocked`，随后 forced fallback 命令执行后仍 `nextMarker === markerBeforeStep` 时，优先沿用原始 `blockedFailureReason`，不再统一压成 `no_progress`
    - 这次只收紧 `stale-private-overlay / missing-private-overlay / missing-visible-state` 三类 blocker 的 forced-fallback-no-progress 归因，不改其它失败语义
- 新增验证：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - `online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress`
    - `online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 命令失败时，仍应明确上报 command_failed`
    - 并与既有
      - `online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS`
      - `online AI watchdog 在 AI active 的 targetingRoll 且 visible state 缺失时，应上报 missing_visible_state 而不是泛化失败`
      同组复跑
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS|online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress|online AI watchdog 在 AI active 的 targetingRoll 且 visible state 缺失时，应上报 missing_visible_state 而不是泛化失败"` => `1 file passed, 3 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress|online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 命令失败时，仍应明确上报 command_failed"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - 这次不是重复回扫旧 continuity，而是补出并修掉了一个新的 caller seam：`response-window` 在 forced fallback 失败后，原始 `missing-visible-state` blocker 之前确实会被吞成粗 `no_progress`
  - 当前这条 seam 已闭，并已补 companion gate 确认 `forced RESPONSE_PASS` 真正命令失败时仍保持 `command_failed`，没有被这次 blocker 透传修复带偏；
  - 但当前仍只覆盖 `response-window -> blocked -> forced RESPONSE_PASS -> no progress / command_failed` 分支；不外推 `manual-response-window` 或 `loop_detected` 粗归因也都已收口。

## 2026-05-20 补 response-window scoped 的 loop_detected 直测

- 继续核对 `response-window / manual-response-window / generic fallback` 剩余 residual 时，发现长期状态里虽然写了“`loop_detected` 已有 direct gate”，但当前 worktree 的 [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts) 实际看不到 `response-window` family 自身的 scoped 直测，只有顶层/别族的泛化口径。
- 本轮补的是“当前证据缺口”，不是新 runtime 修复：
  - [server.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts)
    - 新增 `online AI watchdog 在 response-window 同一 sequence 内若进度 marker 回到已见现场，应上报 loop_detected 而不是继续空转`
    - 用最小 A→B→A marker 回环复现：同一 `response-window` 上连续两次合法动作把 `eventStream.nextId` 从 `1 -> 2 -> 1`，其余 `phase/sourceId/responderIndex/currentPlayerId` 保持不变，强制让 `seenMarkers` 命中旧现场
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS|online AI watchdog 在 response-window 同一 sequence 内若进度 marker 回到已见现场，应上报 loop_detected 而不是继续空转"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - 当前 `response-window` family 现在不再只靠长期状态里那条泛化 “loop_detected 有 gate” 口径撑着，而是补成了当前 worktree 可见、可复跑的 scoped 直测；
  - 这次没有修改业务实现，只是把 `response-window` scoped 的 evidence 补齐；不外推 `manual-response-window` 也已有同等层级的 `loop_detected` 证据。

## 2026-05-20 补 manual-response-window 的 queueSignature 直测

- 继续清理 `manual-response-window` 的证据层级时，发现当前 worktree 里虽然已经有
  - `手动 response-window 只应把 manual-response-window 写进 fingerprint，不应变成新的 reason 分支`
  - 以及 sourceId / windowId 相关的自动 `response-window` 漂移 gate
  但没有一条直接把 `manual-response-window` 自身的 `responderQueue signature` 漂移锁出来。
- 本轮补的是 helper 证据，不是新 runtime 修复：
  - [onlineAiRecovery-gameover.test.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts)
    - 新增 `手动 response-window 在当前 responder 不变但 responderQueue signature 漂移时，fingerprint 与 attemptKey 也必须变化`
    - 直接验证同一 `currentResponder=1` 下，`responderQueue=['1']` 与 `['1','2']` 会生成不同的
      - `fingerprintHint`
      - `resolution.attemptKey`
- 我实际验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "手动 response-window 只应把 manual-response-window 写进 fingerprint，不应变成新的 reason 分支|手动 response-window 在当前 responder 不变但 responderQueue signature 漂移时，fingerprint 与 attemptKey 也必须变化"` => `1 file passed, 2 passed`
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts` => `0 errors / 0 warnings`
- 本轮结论：
  - 当前 `manual-response-window` 不再只靠长期状态里那条 “queueSignature 已补” 的口头记录，而是补成了当前 worktree 可见、可复跑的 helper 直测；
  - 这次没有修改业务实现，只是把 `manual-response-window` 的 queueSignature evidence 落回当前仓库；不外推它已经拥有和 `response-window` 完全对称的所有 family 级 scoped evidence。
