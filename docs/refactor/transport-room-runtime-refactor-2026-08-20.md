# Transport Room Runtime Refactor

日期：2026-08-20

## 目标

把 `GameTransportServer` 从“单个上帝服务对象”重构成职责明确的传输房间运行时。当前目标不是按行数硬拆，而是让以下职责各自有可审查的模块边界：

- 房间生命周期：加载、卸载、连接、离线裁决。
- 权威命令执行：串行锁、队列、batch、回滚、持久化。
- 状态投影与同步：`playerView`、传输裁剪、增量 patch、广播。
- 在线 AI 控制器：即时执行、watchdog、恢复序列、合法动作兜底。
- 诊断反馈：系统反馈、命令失败反馈、circuit breaker 现场。
- 训练数据采集：玩家视角样本、完成对局提交、失败隔离。

## 当前证据

- `src/engine/transport/server.ts` 在本轮开始时约 5611 行；当前约 1807 行，socket route、连接 / 断线 lifecycle、房间注册表 / load 构造、卸载编排、命令失败收口、单命令 stale 拒绝、成功命令收口、batch 协议收口、排队命令 stale 拒绝、setup 初始状态构造和测试 / 管理状态注入已迁出，仍包含广播 / gameover 外部 adapter 和部分命令入口组装。
- `runOnlineAiRecoverySequence` / `runOnlineAiImmediateExecution` 主循环、AI candidate 解析、manual recovery request、repeated recovery unblock 和 circuit failure feedback 编排已迁出 `server.ts`；当前服务端方法只保留兼容测试入口和 adapter 委托。
- `src/engine/transport/__tests__/server.test.ts` 当前约 30682 行，说明测试合同也已经过度集中。
- Summoner Wars 当前受影响最大，在线 AI 验收必须覆盖 `server.test.ts` 的 Summoner Wars watchdog/即时 AI 合同；但小切口不再每次跑 E2E，完成一个实质阶段或触碰 AI 恢复 / 页面节奏主链后再跑 Summoner Wars 真实 E2E。

## 仓库级扫描结论

本轮不是只看 `server.ts`。按 2026-08-20 的仓库扫描，当前至少有四类同源架构债：

1. **传输运行时上帝对象**
   - `src/engine/transport/server.ts` Phase 22 前仍约 3207 行；当前约 1807 行。
   - 同一类里还包括 `src/engine/transport/onlineAiWatchdogSequenceHelpers.ts`、`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts` 等已经拆出的 helper。它们有一部分是有价值的深模块，但也有一部分只是把 server 私有流程切成散函数，尚未形成运行时边界。

2. **传输测试上帝文件**
   - `src/engine/transport/__tests__/server.test.ts` 当前约 30682 行，覆盖同步、权限、队列、batch、反馈、训练数据、watchdog、即时 AI、跨游戏回归。
   - 这会让任何传输改动都变成“改一个点读半本测试”，测试本身已经不能清楚表达模块合同。

3. **Summoner Wars 规则交互与 AI 大模块**
   - `src/games/summonerwars/domain/systems.ts` 当前约 6226 行，混有交互创建、事件后处理、phase-end resolution、具体阵营/卡牌交互、命令桥接。
   - `src/games/summonerwars/ai.ts` 当前约 3309 行，混有合法动作枚举、交互适配、策略特征、评分器、lookahead 策略。
   - `src/games/summonerwars/ui/systemInteractionAdapter.ts` 当前约 1643 行，是 UI 消费引擎交互的集中适配层。它比 Board 更该优先审查，因为它直接决定真人入口与 AI legal-actions 是否同源。

4. **其它游戏和工具也有大文件，但不属于本轮主线**
   - 扫描中还出现 Qidahen、Betrayal、SmashUp、DiceThrone 的超大测试或业务文件。
   - 这些说明项目整体有“大模块长期累积”的问题，但本轮不能把它们并入同一次 transport 重构，否则会扩大验收面并破坏 Summoner Wars 在线 AI 主线。

### 架构判断

- 这不是“超过 1000 行就拆”的问题；真正问题是职责和状态所有权不清。
- `server.ts` 当前不再拥有房间注册表和 load 构造，但仍拥有状态写入、卸载 socket 清理、恢复 adapter 和部分命令收口职责；socket route、连接同步、断线和离线裁决已迁出，但服务端主类还不是健康的房间运行时边界。
- `server.test.ts` 是同一个问题在测试侧的镜像：测试跨过正式边界直接访问私有方法，说明可验证合同还没有被新模块接口承载。
- Summoner Wars 不是 transport 重构的旁观者。它当前受在线 AI 节奏和恢复链影响最大，因此后续每一刀都必须至少保留一条 Summoner Wars 在线 AI 验收。

## 目标形态

```text
GameTransportServer
  - socket namespace 注册
  - 认证入口
  - runtime registry adapter

MatchRoomRegistry
  - active match registry
  - load / getOrLoad / unload cache mutation
  - metadata cache mutation

MatchRoomRuntime
  - 单房间权威状态
  - 命令锁与队列
  - 状态持久化
  - 广播出口

AuthoritativeCommandExecutor
  - executePipeline
  - stale state 拒绝
  - batch / rollback
  - gameover 与成功回调

TransportStateProjection
  - playerView
  - transport stripping
  - patch / full update
  - match players meta

OnlineAiRecoveryController
  - immediate AI execution
  - watchdog candidate resolution
  - recovery sequence
  - repeated recovery unblock

TransportFeedbackReporter
  - command failure feedback
  - online AI recovery feedback
  - circuit breaker feedback

TrainingDataCapture
  - decision sample staging
  - completed match commit
  - skip / discard policy
```

## 已落地切口

### 1. 状态投影与广播

新增 `src/engine/transport/stateProjection.ts`，承接：

- `stripStateForTransport`
- `stripStateForTraining`
- `applyMatchPlayerView`
- `buildTransportMatchPlayers`
- `broadcastProjectedMatchState`

`server.ts` 保留薄委托，现有测试仍可通过旧私有入口验证行为。

### 2. 游戏引擎配置合同

新增 `src/engine/transport/engineConfig.ts`，承接：

- `GameEngineConfig`
- `AnyGameEngineConfig`
- `GameEventTelemetryRecord`
- `GameEventTelemetryFormatter`

`server.ts` 继续 re-export 这些类型，兼容旧 import；`transport/index.ts` 已切到从 `engineConfig.ts` 导出新合同。

### 3. 公共类型引用解绑

业务层、UGC、manifest、页面运行时、AI 与测试里的 `GameEngineConfig` / `AnyGameEngineConfig` / telemetry 类型引用已从 `transport/server` 切到 `transport/engineConfig`。

当前 `transport/server` 搜索只剩两类引用：

- 真正需要 `GameTransportServer` 服务端类的路由入口 / 路由测试。
- `scripts/identify-remaining-files.mjs` 中的显式文件清单。

### 4. 权威单命令执行

新增 `src/engine/transport/authoritativeCommandExecutor.ts`，承接：

- 构造权威 `Command`。
- 调用 `executePipeline`。
- 规范化领域拒绝与 pipeline 异常。
- AI emergency skip 在进入权威管线前翻译为 `SYS_INTERACTION_CANCEL`。

该模块不持久化、不广播、不写 room metadata、不上报反馈、不采集训练数据。`server.ts` 仍保留 stale precondition、socket error、feedback、持久化、training、broadcast、gameover 等房间运行时职责。

### 5. 批命令事务执行

新增 `src/engine/transport/authoritativeBatchExecutor.ts`，承接 batch 事务合同：

- 批次内命令串行执行，抑制中间广播。
- 任一命令失败时，回滚到批次前 `state/stateID`，持久化恢复态，并只广播恢复态。
- 透传 `executeCommandInternal` 记录的真实失败原因，不折叠成泛化失败。
- stale precondition 失败时不进入命令执行。
- 成功时只广播最终状态，并返回裁剪后的权威确认态。

`handleBatch` 与队列消费的 `executeBatchInternal` 已统一走该模块；socket 的 `batch:confirmed` / `batch:rejected` 仍由 `server.ts` 发出，避免新模块拥有 socket 或房间注册表。

### 6. 权威命令成功提交

新增 `src/engine/transport/authoritativeCommandCommit.ts`，承接单条命令成功后的核心提交合同：

- 写入权威 `state`，递增 `stateID`。
- 记录最后命令玩家，供后续广播 meta 使用。
- 处理 Undo 恢复随机游标：重建 tracked random、清空广播缓存、清除 `restoredRandomCursor` 持久化信号。
- 持久化成功后的 `StoredMatchState`。
- 调用 `onCommandSucceeded` 摘要刷新回调。
- 对局卸载后不持久化、不触发成功回调。

无解交互反馈、广播、gameover metadata、stale precondition 和队列调度仍在 `server.ts`，下一步应随 `MatchRoomRuntime` / 命令运行时继续迁移，不能把当前状态称为完成。

### 7. 训练数据采集

新增 `src/engine/transport/trainingDataCapture.ts`，承接训练数据采集合同：

- 训练采集启用判定、manifest capture policy 和默认最小时长。
- human-only / all-seats 采集策略，以及 AI / human seat 过滤。
- 玩家视角训练决策样本构建、pending stage、完成对局提交和 pending discard。
- recorder 失败只告警，不反向影响权威命令执行链。

`server.ts` 现在只保留 `trainingDataRecorder` / `trainingDataMinCompletedMatchDurationMs` 配置读取和成功命令后的采集调用；旧私有采集实现已退出。

### 8. 权威命令队列

新增 `src/engine/transport/authoritativeCommandQueue.ts`，承接单房间权威队列合同：

- 普通命令与 batch 任务共用同一队列，保证进入权威写入口前串行。
- 入队时记录 `stateIDAtEnqueue`，drain 时拒绝 stale 命令，不执行旧状态命令。
- 执行中的 batch 作为队列任务消费，不另建第二套 batch 队列。
- 对局卸载时统一 flush 等待队列，并让等待中的调用方收到失败。

该模块只处理队列顺序和 stale 调度，不拥有 socket、storage、broadcast、feedback 或在线 AI 判断。

### 9. 单房间执行运行时第一刀

新增 `src/engine/transport/matchRoomRuntime.ts`，把 `ActiveMatch` 上的执行锁、权威队列、命令调度和卸载清队列收进同一接口：

- `GameTransportServer` 不再直接写 `match.executing`，改由 `MatchRoomRuntime.tryBeginExecution()` / `finishExecution()` 或 `runExclusive()` 持有和释放执行锁。
- `handleCommand` 的 busy 入队、直接独占执行、成功后触发即时在线 AI 已由 `MatchRoomRuntime.executeCommand()` 承接。
- `handleBatch` 的 busy batch 入队、直接事务执行、成功后触发即时在线 AI 已由 `MatchRoomRuntime.executeBatchTask()` 承接。
- 即时服务端 AI、watchdog recovery sequence 和 `unloadMatch` 也通过同一运行时入口处理执行锁/队列。
- `MatchRoomRuntime` 不复制房间状态，只包住当前 `ActiveMatch`，避免生成第二套房间真相。
- 当前仍是 Phase 2 的入口切口，不是最终房间运行时；metadata merge、load/unload lifecycle、broadcast adapter 和离线裁决仍待迁移。

### 10. 传输反馈 reporter

新增 `src/engine/transport/transportFeedbackReporter.ts`，承接系统反馈上报职责：

- online AI recovery feedback 的冷却去重、默认系统反馈请求体和 HTTP 上报。
- command failure feedback 的冷却去重、默认系统反馈请求体和 HTTP 上报。
- 反馈 build info 补全：保留旧有 `APP_*` 环境字段，缺 `APP_COMMIT_SHA` 时仍从 git short sha 补定位字段。
- `GameTransportServer` 现在只保留“何时需要上报”的触发点和命令失败 payload 所需的 AI 可见状态摘要，不再拥有 endpoint 解析、冷却 Map 或默认 HTTP reporter。
- `server.test.ts` 中直接盯 `postInternalSystemFeedback` / `defaultOnlineAiFeedbackReporter` 私有方法的测试已迁到 `transportFeedbackReporter.test.ts`，避免用测试把反馈职责继续钉在 server 私有实现上。

### 11. 在线 AI 反馈诊断 builder

新增 `src/engine/transport/onlineAiFeedbackDiagnosticsBuilder.ts`，承接反馈 payload 构造职责：

- online AI recovery 的状态快照、actionLog、blocker fingerprint 和 AI 决策预览。
- command failure feedback 的 AI legal-actions 摘要和 payload 组装。
- 无解交互自动跳过反馈的 suppression 判断、trackerKey、状态快照和动作日志构造。
- `GameTransportServer` 现在只保留反馈触发时机，不再直接拼诊断 JSON，也不再保留 `reportOnlineAiRecoveryFeedback` / `reportCommandFailureFeedback` 私有转发包装。
- `server.test.ts` 中旧 `applyPlayerView` / feedback wrapper 私有合同已迁到 `stateSynchronizer` / `transportFeedbackReporter` 的正式 module 接口。

### 12. 在线 AI 恢复运行时账本

新增 `src/engine/transport/onlineAiRecoveryRuntimeLedger.ts`，承接在线 AI recovery controller 的运行时账本职责：

- 当前 recovery tracker、in-flight 占用、重复恢复尝试、overlay resync 冷却由同一 ledger 持有。
- `GameTransportServer` 不再直接拥有 `onlineAiRecoveryTrackers` / `onlineAiRepeatedRecoveryAttempts` / `onlineAiOverlayResyncCooldown` / `onlineAiRecoveryInFlight` 四组 Map/Set。
- 对局卸载时通过 `ledger.clearMatch()` 一次清理该 match 的 tracker、in-flight、重复尝试和 overlay 冷却，不再在 server 生命周期里散落循环清理。
- `server.test.ts` 中旧私有 Map 的 `set/has/delete` 访问已迁到 `onlineAiRecoveryLedger` 的正式测试接口；overlay 冷却测试只读 ledger 暴露的 cooldown keys / expiresAt。
- 该模块只保存运行时账本，不持有房间权威状态、不执行命令、不广播，因此不是第二套房间真相源。

### 13. 在线 AI watchdog tracker / scheduling

把 tick 内的 tracker 创建、等待超时、autoSubmitted 防重和 overlay resync 抑制接到现有 `onlineAiWatchdogScheduling.ts` / `onlineAiWatchdogTracker.ts`：

- `runOnlineAiRecoveryTick` 不再手写“新 tracker / 等待 timeout / 已提交跳过 / 启动恢复”的判断，改消费 `resolveOnlineAiWatchdogSchedulingDecision()`。
- `handleOnlineAiRecoveryFailure` 不再直接调用底层 rejection helper，改消费 `applyOnlineAiRecoveryFailureToTracker()` 更新失败 tracker。
- 删除已无消费者的 `pruneExpiredOnlineAiCooldownEntries()`，overlay 冷却剪枝归 `OnlineAiRecoveryRuntimeLedger`。
- 新增 `onlineAiWatchdogScheduling.test.ts` 与 `onlineAiWatchdogTracker.test.ts`，把 tracker/scheduling 合同从 `server.test.ts` 的大集成测试里拆出直接验证。

### 14. 在线 AI recovery controller 第一刀

新增 `src/engine/transport/onlineAiRecoveryController.ts`，先迁出 watchdog tick 的跨房间调度循环：

- `GameTransportServer.runOnlineAiRecoveryTick()` 现在只委托 `OnlineAiRecoveryController.runTick()`，不再直接持有“遍历 active matches / 判断是否启动 recovery”的调度流程。
- controller 通过 hooks 消费 server adapter：房间枚举、seat controller 构建、candidate 解析、fingerprint、timeout、repeated safe unblock、suppressed feedback、recovery sequence 启动。
- controller 持有的只是调度流程；权威状态、socket、storage、广播和 command execution 仍由现有 `ActiveMatch` / `MatchRoomRuntime` / server hooks 承载，没有新增第二套房间真相源。
- tick 内的 feedback 冷却剪枝、overlay resync 冷却剪枝、in-flight 跳过、无 AI 座位清理、human seat circuit 清理、circuit breaker admission、重复恢复上限、overlay resync 抑制和 recovery launch 都已落到 controller 接口测试。
- `runOnlineAiRecoverySequence` 仍在 `server.ts`，这说明 Phase 3 还没完成；下一刀应迁 recovery sequence 主体或先拆 sequence 内的执行阶段，而不是把 1000+ 行函数原样搬家后宣布完成。

### 15. 在线 AI recovery sequence 进度身份归位

把 `runOnlineAiRecoverySequence` 内用于 `no_progress` / `loop_detected` 的进度身份判断切到既有 `onlineAiWatchdogSequenceFingerprinting.ts` / `onlineAiWatchdogSequenceHelpers.ts`：

- `server.ts` 不再直接拼 interaction semantic fingerprint、seat-view interaction fingerprint、response-window fingerprint、sequence step key、human responder guard、advance-phase guard 和 recovery command mapping。
- `onlineAiWatchdogSequenceFingerprinting.ts` 补齐原 server 私有语义：交互 option 的 `disabled/value`、slider、多步 meta、pending damage、pending bonus dice settlement 都进入 semantic fingerprint，避免同一 progress marker 下把真实 prompt 漂移误判成 `no_progress`。
- `server.ts` 现在通过正式 helper 消费当前权威状态和 playerView；helper 只返回 identity / guard / mapped command，不拥有状态写入、命令执行、广播或反馈。
- 新增 fingerprinting 直测，证明 option 状态变化和 pendingDamage 变化会改变 sequence step key / semantic fingerprint。
- 这刀是职责归位，不是行为变更；完整 `server.test.ts` 和 Summoner Wars E2E 已证明代表链未退化。

### 16. 在线 AI recovery sequence 阶段决策归位

把 `runOnlineAiRecoverySequence` 内的候选重校验、单步 bookkeeping、强制命令 fallback 和 follow-up 转换继续切到正式 helper：

- `onlineAiWatchdogCandidateValidation.ts` 承接 chained candidate、live-state revalidation 和 tracker key 同步判断；`server.ts` 不再直接用局部闭包解释最新 candidate 是否仍属于当前 recovery sequence。
- `onlineAiWatchdogSequenceHelpers.ts` 承接 step before / after snapshot、阻塞原因映射、overlay resync 后暂停、强制恢复命令决策、hard-cancel 判定、response-loop 升级、confirmed-advance 后续 candidate 归一化和 legal-only tracker key 计算。
- `server.ts` 仍保留权威状态写入、命令执行、广播、反馈上报和 legacy response-window mirror 清理；这些是传输运行时动作，不能被纯 helper 吞掉。
- 新增 `onlineAiWatchdogSequenceHelpers.test.ts`，直接覆盖 response-loop 升级、confirmed-advance 后续 legal-action-only 限制，以及 legal-action-only 无合法动作时不得越权执行强制命令。
- 这刀仍不是最终完成；`runOnlineAiRecoverySequence` 主体仍在 `server.ts`，但阶段判断已经从 server 内联业务分支迁回 sequence 模块接口。

### 17. 在线 AI recovery sequence 收口反馈决策归位

把 `runOnlineAiRecoverySequence` 末尾的失败收口、forced fallback 失败分派和成功反馈分支继续切到 `onlineAiWatchdogSequenceHelpers.ts`：

- `resolveOnlineAiRecoveryCompletionFailureDispatchDecision()` 承接 `blocker_persisted` / `no_progress` 收口判断；`server.ts` 只负责按决策重校验 candidate 并调用正式失败上报入口。
- `resolveOnlineAiForcedRecoveryFailureDispatchDecision()` 承接 legal-action 失败、advance guard 阻断和 forced command 执行失败的原因选择；`server.ts` 仍保留权威命令执行副作用。
- `resolveOnlineAiRecoverySuccessFeedbackDecision()` 统一 legal-action recovered、observed recovery 和 force-end-turn success 三类成功反馈元数据；诊断快照和 action log 仍由 server 的反馈诊断 builder 生成。
- `onlineAiWatchdogSequenceHelpers.test.ts` 增补收口失败、forced fallback 失败和 observed recovery 成功反馈的直接合同测试，避免继续只靠 `server.test.ts` 私有方法证明分支。
- 这刀减少了 `server.ts` 对 recovery 业务结果解释的直接持有；但 recovery sequence while 主循环、manual response-window preservation 判断、legacy mirror 清理判断和 repeated recovery hooks 当时仍未迁出，不能称为最终完成。

### 18. 在线 AI recovery response-window 特例判断归位

把 `runOnlineAiRecoverySequence` 开头的 manual response-window 保留判断和 legacy response-window mirror 清理判断继续迁到 `onlineAiWatchdogSequenceHelpers.ts`：

- `shouldPreserveManualHumanResponseWindowForceClose()` 承接“AI 卡住但当前响应者是真人时，保留 manual response-window 强关候选”的判断，避免 server 直接解析 responder queue 和 recovery fingerprint。
- `resolveOnlineAiLegacyResponseWindowMirrorClearDecision()` 承接 legacy mirror sourceId 白名单判断；`server.ts` 仍只负责清空 `responseWindow.current`、递增 stateID、持久化、广播和记录日志。
- `onlineAiWatchdogSequenceHelpers.test.ts` 增补 manual response-window 保留和 legacy mirror sourceId 清理的直接合同测试。
- 这刀不是新增保护层，也没有新建第二套 response-window 状态；只是把“该不该做”的判断迁到 sequence helper，把“真正改状态”的副作用留在唯一服务端写入口。

### 19. 在线 AI legal-action recovery coordinator

新增 `src/engine/transport/onlineAiLegalActionRecoveryCoordinator.ts`，承接从 recovery candidate 到 AI legal-action recovery 的协调职责：

- coordinator 调用 `resolveOnlineAiRecoveryDispatch()` 和 `executeOnlineAiLegalActionRecovery()`，处理 private overlay blocked、emergency playerView retry、ownership 变化、recovery resolved 和 authoritative invalid command 分派。
- `server.ts` 仍提供权威副作用 adapter：`playerView`、权威命令执行、广播、反馈、circuit failure 和 overlay resync；coordinator 不拥有房间状态、不持久化、不广播第二套状态。
- 新增 `onlineAiLegalActionRecoveryCoordinator.test.ts`，直接覆盖 private overlay blocked 不上权威命令，以及合法动作通过唯一 `executeCommand` adapter 执行并回写恢复结果。
- 这刀解决的是“legal-action 恢复协调不该混在 server 主循环里”，不是把 command 执行移到新模块；唯一写入口仍在服务端/运行时 adapter。

### 20. 在线 AI recovery sequence runner

新增 `src/engine/transport/onlineAiRecoverySequenceRunner.ts`，承接 `runOnlineAiRecoverySequence` 的 while 编排职责：

- runner 持有 recovery sequence 的重校验、分片、legal-action 尝试、forced fallback、hard-cancel、follow-up、成功/失败收口和 legacy response-window mirror 清理触发顺序。
- `server.ts` 的 `runOnlineAiRecoverySequence()` 现在只委托 runner；状态持久化、stateID 递增、广播、反馈、命令执行和日志全部通过 server hooks 进入唯一权威 adapter。
- 新增 `onlineAiRecoverySequenceRunner.test.ts`，直接覆盖 legal-action 成功恢复反馈，以及 legal-action 不可用时通过唯一强制命令 hook 收口。
- 这不是按行数硬搬：sequence runner 的接口承载的是旧恢复序列合同，`server.ts` 不再持有 recovery while 主循环。

### 21. 在线 AI immediate execution runner

新增 `src/engine/transport/onlineAiImmediateExecutionRunner.ts`，承接 `runOnlineAiImmediateExecution` 的即时 AI 循环和 fallback recovery 调度：

- runner 持有“即时 AI 可执行则继续执行；即时 AI miss 后解析 recovery candidate；legal-action 不可用且允许强制恢复时委托 recovery sequence”的流程。
- 服务端只提供 adapter：seat controller 构建、房间执行锁、AI command sequence 执行、candidate 解析、tracker 写入、recovery sequence 委托和 trace logging。
- 新增 `onlineAiImmediateExecutionRunner.test.ts`，覆盖无 AI seat 时清理账本/circuit 且不占用执行锁，以及 legal-action miss 后委托 recovery sequence。
- immediate runner 与 sequence runner 共用同一 `OnlineAiRecoveryRuntimeLedger` 和 `MatchRoomRuntime` adapter，没有新增第二套 in-flight、状态写入或命令执行路径。

### 22. 在线 AI recovery candidate resolver

新增 `src/engine/transport/onlineAiRecoveryCandidateResolver.ts`，承接 watchdog / immediate runner / manual force 共用的 recovery candidate 解析职责：

- resolver 持有 hidden seat view 检查、`seat-legal-only` 候选、manual setup 选择压制、`response-window` 到 `response-loop` 升级判断。
- `server.ts` 只提供只读 adapter：当前私有 playerView、当前 recovery tracker、recovery fingerprint builder；resolver 不写状态、不广播、不执行命令。
- 新增 `onlineAiRecoveryCandidateResolver.test.ts`，覆盖 stale private overlay 形成 `seat-legal-only`、manual setup 压制、纯 AI response-loop 升级以及含真人 responder 时不得升级。
- 这刀不是白名单扩展；它把既有候选合同迁出 server，继续保持 AI seat only 和 human responder guard。

### 23. 在线 AI manual recovery coordinator

新增 `src/engine/transport/onlineAiManualRecoveryCoordinator.ts`，承接人工 setup 选择和人工强制 AI 收口的请求编排：

- coordinator 负责 owner 授权、人工 setup 选择合法动作重建、manual force 忙碌 / unavailable 拒绝、tracker 创建和 recovery sequence 启动。
- `server.ts` 仍是 socket route 与唯一命令写入口：人工 setup 最终命令通过 `handleCommand()`，manual force 通过既有 `runOnlineAiRecoverySequence()`。
- 新增 `onlineAiManualRecoveryCoordinator.test.ts`，覆盖人工 setup 只提交意图且命令从当前 legal action 生成、房间执行中拒绝 manual force、空闲时设置 tracker 并复用 recovery sequence。
- 这刀移走的是请求编排职责，不新增第二套 manual state、第二套 in-flight 或第二套 recovery 成功判定。

### 24. 在线 AI repeated recovery coordinator

新增 `src/engine/transport/onlineAiRepeatedRecoveryCoordinator.ts`，承接 repeated recovery 上限后的副作用编排：

- coordinator 复用既有 `onlineAiRepeatedRecoveryUnblockExecutor.ts` 做核心判断，不重写哪些状态能强制解卡。
- `server.ts` 不再直接持有 `tryForceUnblockRepeatedOnlineAiRecovery()` / `reportOnlineAiRepeatedRecoverySuppressed()` 两段私有业务编排；controller hook 改为委托 coordinator。
- 状态写入口仍是 `executeCommandInternal()`，重复尝试标记仍通过 `OnlineAiRecoveryRuntimeLedger`，反馈仍通过 `TransportFeedbackReporter`，没有新增第二套 tracker、in-flight 或命令执行路径。
- 新增 `onlineAiRepeatedRecoveryCoordinator.test.ts`，覆盖 repeated suppression 上报和 force-unblocked 成功反馈合同。

### 25. 在线 AI circuit failure coordinator

新增 `src/engine/transport/onlineAiCircuitFailureCoordinator.ts`，承接在线 AI circuit 失败记录、熔断反馈和熔断前拒绝命令的副作用编排：

- coordinator 持有同一个 `OnlineAiCircuitBreaker` 实例，不复制熔断状态；`server.ts` 只保留 socket error 的外部适配 hook。
- `recordOnlineAiCircuitFailure()` / `rejectOnlineAiCircuitCommand()` 在 `server.ts` 中收缩为薄转发，circuit breaker state snapshot、actionLog、一次性熔断反馈和 reject 日志由新模块统一负责。
- 新增 `onlineAiCircuitFailureCoordinator.test.ts`，覆盖熔断反馈只上报一次、诊断快照保留命令 / 队列 / clientTransport，以及拒绝命令仍写回失败原因并通知玩家。
- 这刀解决的是反馈 / circuit 触发点混在服务端主类的问题，不改变 admit 规则、不改变 AI recovery 或玩家命令执行语义。

### 26. transport socket router

新增 `src/engine/transport/transportSocketRouter.ts`，承接 `/game` namespace 的 socket 事件路由：

- router 负责 `sync` / `command` / `batch` / `manual-setup-selection` / `manual-force-end-ai-phase` / `ui:event` / `disconnect` 的事件解析、socket 当前房间校验、授权拒绝和 ack / error 语义。
- `server.start()` 已收缩为 `registerGameSocketRoutes({ namespace, hooks })`；真正状态写入、命令执行、manual recovery 和 disconnect lifecycle 仍通过 server hooks 进入现有权威入口。
- 新增 `onlineAiClientTransportDiagnostics.ts`，把 command/batch 共用的 online AI attempt key 与 client transport diagnostics 归一化从 `server.ts` 移出。
- 这不是第二个 server：router 不持有 active match registry、不持久化、不执行命令、不广播状态，只把 socket 协议翻译到正式 hook。

### 27. match connection lifecycle coordinator

新增 `src/engine/transport/matchConnectionLifecycleCoordinator.ts`，承接连接同步、断线清理和离线裁决 lifecycle：

- `handleSync()` 现在只委托 coordinator；取/加载房间、用最新 metadata 认证、登记 socket、取消离线定时器、持久化在线状态、`state:sync` 和同步后的 immediate AI 触发都在同一 lifecycle 模块里。
- `handleDisconnect()` / `removeSocketFromMatch()` / `onPlayerFullyDisconnected()` / `scheduleOfflineAdjudication()` / `runOfflineAdjudication()` 在 `server.ts` 中收缩为薄委托；旧测试入口保留，但实现不再写在 server 主类。
- 离线裁决默认表和游戏配置 override 已迁到 lifecycle 模块，避免 `server.ts` 与新模块各保留一份交互 kind 判定。
- 新增 `matchConnectionLifecycleCoordinator.test.ts`，覆盖 match_not_found、最新 metadata 认证、旁观者同步、旧 socket 移除、认证失败、玩家断线、旁观者断线和离线裁决默认 / 禁用合同。

### 28. match room registry

新增 `src/engine/transport/matchRoomRegistry.ts`，承接 active match registry、存储加载和 metadata cache mutation：

- `MatchRoomRegistry` 现在持有 active match map；`server.ts` 的 `activeMatches` 只保留为旧测试兼容 getter，主逻辑不再直接读写这张表。
- `loadMatch()` 已收缩成 `matchRoomRegistry.load()` 薄委托；stored state、metadata、game config、AI seat、random seed / cursor 和初始房间运行态构造都在 registry 模块内完成。
- `updateMatchMetadata()`、`mergeActiveMetadata()`、`validateTestAccess()`、`injectState()`、`disconnectPlayer()`、`unloadMatch()`、socket router 和 lifecycle/recovery hooks 已切到 `matchRoomRegistry.get()` / `getOrLoad()` / `values()` / `replaceMetadata()` / `mergeMetadata()` / `delete()`。
- 这不是新增第二套房间状态：registry 是 active match map 的唯一所有者；`server.ts` 只在 unload 时执行 socketIndex 清理、online AI ledger 清理和可选 socket disconnect 等外部副作用。
- 新增 `matchRoomRegistry.test.ts`，覆盖 load 构造、getOrLoad 复用、缺状态/metadata/game config 拒绝、metadata 替换/合并和 random seed/cursor 恢复。

### 29. match room unload coordinator

新增 `src/engine/transport/matchRoomUnloadCoordinator.ts`，承接房间销毁时的 runtime unload lifecycle：

- `unloadMatch()` 已收缩为 `matchRoomUnloadCoordinator.unloadMatch()` 薄委托；server 不再直接清 offline timer、socketIndex、active match registry、online AI recovery ledger 和 circuit breaker。
- coordinator 负责按固定顺序执行：标记房间 runtime 已卸载、清离线定时器、清 socket 索引、删除 active match、清 AI 账本、清 circuit state，并在需要时向房间 socket 发送 `match_not_found` 后断开。
- 这不是第二套状态；coordinator 只编排销毁副作用，真正 registry、socket.io namespace、AI ledger 和 circuit breaker 仍由 server hooks 提供。
- 新增 `matchRoomUnloadCoordinator.test.ts`，覆盖房间不存在、卸载副作用顺序、断开 socket 前发送 `match_not_found`、断开失败不回滚已完成卸载。

### 30. authoritative command failure coordinator

新增 `src/engine/transport/authoritativeCommandFailureCoordinator.ts`，承接权威命令执行失败后的副作用收口：

- `executeCommandInternal()` 的 `!execution.success` 分支已收缩为 coordinator 委托；server 不再直接编排 last failure、AI circuit failure、玩家 socket error、command failure feedback 和 pipeline exception 后的 pending interaction cancel。
- coordinator 不执行命令、不持久化、不广播；它只消费 authoritative executor 的失败结果并把失败语义落到既有 hook。
- 新增 `authoritativeCommandFailureCoordinator.test.ts`，覆盖 AI 命令失败记录 circuit / 通知玩家 / 上报反馈、真人领域拒绝不记录 AI circuit，以及 pipeline exception 自动 cancel 后恢复原失败原因。
- 这刀保护的是失败收口合同，不改变领域拒绝码、反馈触发策略或 command execution pipeline。

### 31. authoritative command stale rejection coordinator

新增 `src/engine/transport/authoritativeCommandStaleRejectionCoordinator.ts`，承接单条命令进入 pipeline 前的 stale state 拒绝合同：

- `executeCommandInternal()` 不再内联 AI / 真人两套 stale precondition 分支；统一由 coordinator 判断 `expectedStateID` 是否落后当前权威 `stateID`。
- AI stale 拒绝仍写 `lastCommandFailureReason = stale_state`、记录 online AI circuit failure、保留 command payload / client transport 诊断并向玩家 socket 发 `stale_state`。
- 真人 stale 拒绝仍只写失败原因、记录 warn 日志并向玩家 socket 发 `stale_state`，不污染 AI circuit。
- 新增 `authoritativeCommandStaleRejectionCoordinator.test.ts`，覆盖未 stale 不动、AI stale 记录 circuit、真人 stale 不记录 AI circuit 三条合同。
- 这刀不是新增兜底防护；它迁移的是已有正常业务拒绝路径，仍然不接管执行、持久化、广播或 batch stale admission。

### 32. authoritative command success coordinator

新增 `src/engine/transport/authoritativeCommandSuccessCoordinator.ts`，承接单条权威命令成功后的收口顺序：

- `executeCommandInternal()` 不再内联成功日志、游戏事件 telemetry、无解交互反馈构造、成功提交、训练样本、广播和 gameover metadata 收口；成功分支已收缩为 coordinator 委托。
- coordinator 复用既有 `commitAuthoritativeCommandSuccess()` 与 `runAuthoritativeCommandSuccessEffects()`，没有新建第二套状态提交、训练采集或 gameover 判断。
- server 仍提供外部 adapter：存储写入、playerView/stripForTraining、反馈 reporter、广播、circuit 清理、metadata 持久化和回调；这些 adapter 后续应随 MatchRoomRuntime / broadcast seam 继续收口。
- 新增 `authoritativeCommandSuccessCoordinator.test.ts`，覆盖普通成功提交与反馈广播、已卸载对局停止后续副作用、首次 gameover metadata / circuit / 回调收口。
- 这刀保护的是成功命令的执行后合同，不改变玩家可观察行为，不改变 batch suppress broadcast 语义，也不改变训练采集策略。

### 33. authoritative batch coordinator

新增 `src/engine/transport/authoritativeBatchCoordinator.ts`，承接 batch 协议协调与 stale state admission：

- `handleBatch()` / `executeBatchInternal()` 不再直接组装 `executeAuthoritativeCommandBatch()`、batch stale 拒绝、AI circuit admission 和 socket 回包；server 只保留进入 `MatchRoomRuntime` 的执行锁 / 入队语义。
- coordinator 持有 batch 的协议结果解释：`command-rejected` 发真实失败原因、`confirmed` 发权威状态、stale precondition 拒绝时区分真人和 AI seat。
- AI batch stale 仍复用现有 `OnlineAiCircuitBreaker` 和 `recordOnlineAiCircuitFailure()`，不新增第二套 circuit 状态；真人 stale 仍只按正常业务拒绝返回 `stale_state`。
- socket emit、storage rollback、broadcast、单命令执行、seat controller 查询和 circuit failure 记录都通过 server adapter 注入；coordinator 不拥有 socket、不持久化、不广播第二套状态。
- `QueuedAuthoritativeBatch.execute()` 从 `Promise<void>` 改为 `Promise<boolean>`，让排队 batch 的调用方拿到真实成功 / 失败结果，避免失败 batch 被队列层误报成功。
- 新增 `authoritativeBatchCoordinator.test.ts`，覆盖 batch confirmed、命令失败回滚并透传原因、真人 stale、AI stale 记录 circuit、stale epoch 已拦截不重复记录 circuit。
- 补充 `authoritativeCommandQueue.test.ts`，覆盖排队 batch 失败会把 `false` 传回调用方；`matchRoomRuntime.test.ts` 同步表达 queued batch 的成功值合同。

### 34. authoritative queued command stale rejection coordinator

新增 `src/engine/transport/authoritativeQueuedCommandStaleRejectionCoordinator.ts`，承接排队命令因权威状态前进而过期时的拒绝合同：

- `rejectStaleQueuedCommand()` 不再在 `server.ts` 内联解析 AI / human、expected state、watchdog source、circuit admission 和 stale failure 记录；server 只保留 `MatchRoomRuntime` 队列 handler 的入口委托。
- coordinator 明确排队命令 stale 的语义：真人命令只记录丢弃日志，AI 命令在 circuit 允许时记录 `stale_state` failure，circuit 已拒绝时不重复记 failure。
- watchdog 入队命令仍沿用 `online-ai-watchdog` 对应的 circuit source；普通客户端入队命令仍走 `client` source。
- 这不是新增兜底防护；它迁移的是既有队列过期路径，没有改变队列串行、socket 回包、状态写入或成功回调。
- 新增 `authoritativeQueuedCommandStaleRejectionCoordinator.test.ts`，覆盖真人 stale、AI stale allowed、AI stale blocked、watchdog source 四条合同。

### 35. match setup state factory

新增 `src/engine/transport/matchSetupStateFactory.ts`，承接创建对局时的初始权威状态构造合同：

- `setupMatch()` 不再在 `server.ts` 内联 setup 玩家顺序、seeded random、domain.setup、系统状态和 AI undo seat 写入；server 只查找游戏配置并委托新工厂。
- 工厂持有 setup 组合顺序：可信 seat controller 读取、混合人机默认真人先手、显式 `firstPlayerId` / `turnOrder` 不覆盖、domain.setup 透传 setupData、系统状态创建和 AI 座位写入 undo。
- 新增 `src/engine/transport/trackedRandom.ts`，把 tracked random 从 `matchRoomRegistry` 中移出；registry、server hook 和 setup factory 共同依赖同一个随机源模块，避免初始状态构造反向依赖房间注册表。
- 这不是第二套起局状态；setup factory 只负责把已有旧合同组装成唯一初始 `MatchState`，真实创建 / 保存 / 连接仍走既有 server、storage 和 room lifecycle。
- 新增 `matchSetupStateFactory.test.ts`，覆盖 seeded random cursor、setupData 原样透传、混合人机真人先手、显式顺序不覆盖、AI seat 写入 undo。

### 36. match state injection coordinator

新增 `src/engine/transport/matchStateInjectionCoordinator.ts`，承接测试 / 管理状态注入合同：

- `injectState()` 不再在 `server.ts` 内联环境门禁、状态结构校验、房间加载、持久化、增量同步缓存清理和广播；server 只保留公开方法委托。
- coordinator 明确这是测试 / 管理入口，不是生产命令写入口：它不执行命令、不跑 pipeline、不产生游戏事件，也不接管玩家 socket route。
- 状态注入生命周期调整为先持久化、再切换 active match 内存状态并广播；这样存储失败时不会留下“存储没变但内存已变”的半注入状态。
- adapter 仍由 server 注入：`MatchRoomRegistry.getOrLoad()`、`storage.setState()`、`TransportStateSynchronizer.clearAllBaselines()` 和 `broadcast()`，没有新增第二套房间 registry 或广播实现。
- 新增 `matchStateInjectionCoordinator.test.ts`，覆盖环境门禁、非法状态、找不到房间、持久化失败不污染内存、成功后清缓存并广播；旧 `server-injectState.test.ts` 继续覆盖公开 server 入口。

## 下一批切口

### Phase 0：清理计划与旧 import 债（已完成首轮）

- 已把仍从 `transport/server` 引用 `GameEngineConfig` / telemetry 类型的消费者切到 `transport/engineConfig`。
- 目标不是减少运行时代码，而是让 `server.ts` 不再被类型合同当作公共入口。
- 后续若还有新消费者需要类型，应走 `transport/engineConfig` 或 `transport` barrel，不得重新依赖 `server.ts`。

### Phase 1：命令执行运行时

- 已抽 `AuthoritativeCommandExecutor` 承接单条命令的权威 pipeline 执行与失败分类。
- 已抽 `AuthoritativeBatchExecutor` 承接 batch rollback、最终广播和确认态构造。
- 已抽 `AuthoritativeCommandCommit` 承接单命令成功后的核心状态提交与持久化。
- 已抽 `TrainingDataCapture` 承接训练样本和完成对局采集。
- 已抽 `AuthoritativeCommandQueue` 承接队列顺序、stale 入队拒绝和 unloaded flush。
- 已抽 `MatchRoomRuntime` 承接玩家命令 / batch 命令的运行时调度入口，`server.ts` 只组装 socket 回包和执行回调。
- 已抽 `AuthoritativeCommandFailureCoordinator`、`AuthoritativeCommandStaleRejectionCoordinator` 和 `AuthoritativeCommandSuccessCoordinator` 承接单命令失败 / stale / 成功收口。
- 尚未完成：batch stale admission、broadcast 外部 adapter、gameover 外部 adapter 和 socket 回包仍在 `server.ts`，下一步应继续迁到房间运行时或命令运行时，而不是继续堆在 socket route 层。
- 玩家命令、在线 AI 命令、batch 命令仍必须共用这一条唯一权威写入口。
- 不允许为 AI 或 batch 新增第二套状态写入、第二套 rollback 或第二套 failure reason 解释。
- 验收：新增 executor 直测；保留 `server.test.ts` 中 stale、batch、command failure、training sample 代表合同。

### Phase 2：房间运行时

- `MatchRoomRuntime` 已先接管执行锁、commandQueue、unloaded queue flush、玩家命令调度和 batch 任务调度。
- `transportSocketRouter` 已承接 socket 事件解析与协议错误/ack 语义；`matchConnectionLifecycleCoordinator` 已承接 sync、断线、连接 metadata 和离线裁决 lifecycle。
- 后续继续让房间运行时持有单房间 active state、unload 外部副作用、broadcast adapter。
- `GameTransportServer` 收缩为 namespace 注册、认证入口和 runtime registry adapter。
- 离线裁决和 disconnect lifecycle 已从 server 主类迁出，不留在 socket route 层。
- 验收：同步/重连/离座/卸载/队列合同迁到 runtime 测试；`server.test.ts` 只保留 socket route 集成合同。

### Phase 3：在线 AI 控制器

- `OnlineAiRecoveryRuntimeLedger` 已先承接 tracker / repeated attempt / overlay resync cooldown / in-flight 账本，watchdog scheduling / tracker failure 更新已切到正式 helper。
- `OnlineAiRecoveryController` 已先承接 watchdog tick 的跨房间调度循环，`server.ts` 的 tick 入口已收缩成 controller 委托。
- recovery sequence 的进度身份、候选重校验、loop/no-progress bookkeeping、强制命令 fallback、follow-up 转换、失败收口、成功反馈决策、manual response-window 保留判断和 legacy mirror 清理判断已切到 `onlineAiWatchdogSequenceFingerprinting.ts` / `onlineAiWatchdogCandidateValidation.ts` / `onlineAiWatchdogSequenceHelpers.ts`，server 不再维护这些平行业务判断。
- `OnlineAiLegalActionRecoveryCoordinator` 已承接 legal-action recovery 协调；`OnlineAiRecoverySequenceRunner` 已承接 recovery sequence 主循环；`OnlineAiImmediateExecutionRunner` 已承接 immediate AI 循环和 fallback recovery 调度。
- `OnlineAiRecoveryCandidateResolver` 已承接 recovery candidate 解析；`OnlineAiManualRecoveryCoordinator` 已承接 manual setup / manual force request 编排。
- `OnlineAiRepeatedRecoveryCoordinator` 已承接 repeated recovery unblock 的副作用编排；`OnlineAiCircuitFailureCoordinator` 已承接 circuit failure / tripped feedback / circuit rejection 编排。
- 尚未完成：legacy mirror 清理副作用 adapter、部分 socket route、command failure socket error 发送和 room lifecycle 仍留在 `server.ts` 或 server hooks。
- 控制器只能通过 `MatchRoomRuntime` 暴露的读状态、执行命令、广播、反馈接口工作，不能直接拥有 socket map、storage map 或 active match registry。
- 后续应继续迁 socket route、房间 lifecycle 和剩余命令收口 adapter，不能因为在线 AI 主链已明显收缩就宣称 transport runtime 完成。
- 验收：watchdog 直测覆盖 human guard、AI current + human responder、hidden interaction、private overlay stale/missing；Summoner Wars 真实 E2E 必跑。

### Phase 4：反馈与训练数据

- `TransportFeedbackReporter` 已承接 command failure、online AI recovery 的冷却、默认请求体和 HTTP reporter；`OnlineAiFeedbackDiagnosticsBuilder` 已承接 recovery / command failure / unsatisfiable interaction 的诊断 payload 构造；`OnlineAiCircuitFailureCoordinator` 已承接 circuit breaker 的失败记录、熔断反馈和拒绝命令反馈编排。
- `TrainingDataCapture` 已落地，后续只需在 `MatchRoomRuntime` 接管命令提交后把调用点随提交合同迁移。
- 这两层只能消费执行结果和运行时快照，不能反向拥有状态推进能力。
- 验收：已有 `commandFailureFeedbackPayload`、`onlineAiCircuitFeedbackDiagnostics`、`onlineAiUnsatisfiableInteraction` 测试继续保留；新增 reporter / diagnostics builder / capture 合同测试。

### Phase 5：Summoner Wars 专项后续

- 在 transport 主要写入口稳定后，再拆 Summoner Wars。
- `domain/systems.ts` 按“交互工厂 / phase-end resolution / 事件后处理 / 命令桥接”拆，而不是按卡牌名机械分文件。
- `ai.ts` 按“legal action builders / interaction adapter / strategy feature snapshot / scorers / policy runtime”拆，确保真人可执行动作与 AI legal-actions 继续同源。
- `systemInteractionAdapter.ts` 应跟 `ai.ts` 对照审查，目标是同一规则交互只写一份业务身份和候选解析，UI 与 AI 各自消费。
- 验收：Summoner Wars `interaction-chain-comprehensive.test.ts`、`basic-commands-coverage.test.ts`、transport 在线 AI 定向测试、真实 E2E。

### Phase 6：非本轮主线 backlog

- Qidahen、Betrayal、SmashUp、DiceThrone 的大文件只登记为后续候选，不在本轮 transport runtime 重构中同步拆。
- 只有当某个文件直接影响当前 transport / Summoner Wars 在线 AI 合同时，才进入本轮改动面。

## 禁止路线

- 禁止按行数硬拆，把一个大函数搬到另一个大文件后宣称架构变好。
- 禁止新增兼容桥来长期保留旧私有入口；除非存在真实跨版本消费者，否则同轮切换消费者。
- 禁止把 watchdog 加强成全局强推；AI 兜底仍只能作用于 AI seat，并且必须区分 human 正常响应与 AI 阶段被 human 响应窗口卡住。
- 禁止让测试继续主要靠 `(server as any).privateMethod` 断言内部过程；每迁出一个深模块，就补对应模块接口测试。
- 禁止在 Summoner Wars 里把 UI 选项文案、数组下标或按钮形态当作 AI 决策真相源。

## 验收矩阵

| 改动面 | 最低验证 |
| --- | --- |
| 状态投影 / 广播 | `server.test.ts -t "state:sync|broadcastState"` |
| Summoner Wars 在线 AI | `server.test.ts -t "Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"` |
| 在线 AI 恢复序列 | transport AI watchdog 定向测试 + Summoner Wars E2E |
| 反馈 reporter | `transportFeedbackReporter.test.ts` + server command/watchdog feedback 定向测试 |
| 共享传输层 | `npx eslint` 覆盖改动文件 |
| evidence / 规范结构 | 若修改 evidence 或 `.spec`，运行对应 `audit:evidence:selfcheck` / `spec:lint` |

## 已执行验证

- `npx eslint src\engine\transport\server.ts src\engine\transport\stateProjection.ts src\engine\transport\engineConfig.ts src\engine\transport\index.ts`
- `npx eslint <Phase 0 类型引用改动文件>`：0 error；保留既有 warning（`UGCSandbox.tsx` render 中 `Date.now()`、`test.routes.test.ts` unused args），本轮未改其行为。
- `rg "transport/server"`：剩余引用只包括 `GameTransportServer` 服务端类入口和脚本清单，不再有业务配置类型消费者。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "state:sync|broadcastState"`：6 passed
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"`：7 passed
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/playerView.test.ts --configLoader native`：3 passed
- `npx eslint src\engine\transport\authoritativeBatchExecutor.ts src\engine\transport\__tests__\authoritativeBatchExecutor.test.ts src\engine\transport\authoritativeCommandExecutor.ts src\engine\transport\__tests__\authoritativeCommandExecutor.test.ts src\engine\transport\server.ts`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts --configLoader native`：2 files passed；7 passed
- `npx eslint src\engine\transport\authoritativeCommandCommit.ts src\engine\transport\__tests__\authoritativeCommandCommit.test.ts src\engine\transport\server.ts`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts --configLoader native`：3 files passed；10 passed
- `npx eslint src\engine\transport\trainingDataCapture.ts src\engine\transport\__tests__\trainingDataCapture.test.ts src\engine\transport\authoritativeCommandCommit.ts src\engine\transport\__tests__\authoritativeCommandCommit.test.ts src\engine\transport\authoritativeBatchExecutor.ts src\engine\transport\__tests__\authoritativeBatchExecutor.test.ts src\engine\transport\authoritativeCommandExecutor.ts src\engine\transport\__tests__\authoritativeCommandExecutor.test.ts src\engine\transport\server.ts`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/trainingDataCapture.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts --configLoader native`：4 files passed；15 passed
- `npx eslint src\engine\transport\matchRoomRuntime.ts src\engine\transport\__tests__\matchRoomRuntime.test.ts src\engine\transport\authoritativeCommandQueue.ts src\engine\transport\__tests__\authoritativeCommandQueue.test.ts src\engine\transport\server.ts`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts --configLoader native`：2 files passed；9 passed
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：6 files passed；24 passed
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "stale_state|batch 内|command failure|AI seat-view 只剩 emergency skip|Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"`：13 passed，268 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "match-ai-queued-stale-circuit|queued stale|stale_state|batch 内|command failure|AI seat-view 只剩 emergency skip|Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"`：1 file passed；13 passed，268 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "成功命令后应采集训练决策样本|training recorder 失败不应影响命令执行|默认应跳过 AI seat 的训练样本|每游戏配置"`：3 passed，278 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "刷新房间摘要"`：1 passed，280 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "成功命令后应采集训练决策样本|training recorder 失败不应影响命令执行|未完成对局即使超过时长门槛|完整对局低于时长门槛|默认应跳过 AI seat|manifest 声明 all-seats|刷新房间摘要|stale_state|batch 内|command failure|AI seat-view 只剩 emergency skip|Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"`：1 file passed；20 passed，261 skipped
- `node scripts/infra/run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `etHkcCk5VuL`，`returnedElapsedMs=2539`
  - 连续召唤 match `ZOzXjohNXP3`，服务端事件间隔 `firstToSecondSummonEventGapMs=1007`
- `npm run audit:evidence:selfcheck -- evidence\engine\online-ai-visible-delay-budget-2026-08-19.md evidence\summonerwars\summonerwars-online-ai-delay-2026-08-19.md`：OK
- `npx eslint src\engine\transport\transportFeedbackReporter.ts src\engine\transport\__tests__\transportFeedbackReporter.test.ts src\engine\transport\server.ts src\engine\transport\__tests__\server.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/transportFeedbackReporter.test.ts --configLoader native`：1 file passed；2 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/transportFeedbackReporter.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessEffects.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：8 files passed；30 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 自动反馈冷却|online AI watchdog 自动反馈应携带交互选项|在线命令 pipeline 异常时应自动上报后台反馈|batch 内 pipeline 异常也应自动上报后台反馈|在线 AI watchdog 的失败命令应记录实际参数|在线 AI watchdog 选出的动作若被权威领域状态拒绝"`：1 file passed；6 passed，273 skipped
- `npx eslint src\engine\transport\transportStateSynchronizer.ts src\engine\transport\__tests__\transportStateSynchronizer.test.ts src\engine\transport\server.ts src\engine\transport\__tests__\server.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/transportStateSynchronizer.test.ts --configLoader native`：1 file passed；2 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 自动反馈冷却期内应按 trackerKey 去重"`：1 file passed；1 passed，278 skipped
- `npx eslint src\engine\transport\onlineAiFeedbackDiagnosticsBuilder.ts src\engine\transport\__tests__\onlineAiFeedbackDiagnosticsBuilder.test.ts src\engine\transport\server.ts src\engine\transport\__tests__\server.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiFeedbackDiagnosticsBuilder.test.ts --configLoader native`：1 file passed；3 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiFeedbackDiagnosticsBuilder.test.ts src/engine/transport/__tests__/transportStateSynchronizer.test.ts src/engine/transport/__tests__/transportFeedbackReporter.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessEffects.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：10 files passed；35 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native`：1 file passed；279 passed
- `npx eslint src\engine\transport\onlineAiWatchdogTracker.ts src\engine\transport\__tests__\onlineAiWatchdogTracker.test.ts src\engine\transport\onlineAiWatchdogScheduling.ts src\engine\transport\__tests__\onlineAiWatchdogScheduling.test.ts src\engine\transport\onlineAiRecoveryRuntimeLedger.ts src\engine\transport\__tests__\onlineAiRecoveryRuntimeLedger.test.ts src\engine\transport\server.ts src\engine\transport\__tests__\server.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts --configLoader native`：3 files passed；13 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "重复恢复|overlay resync|response-loop existing tracker|online AI watchdog 自动反馈冷却期内应按 trackerKey 去重"`：1 file passed；9 passed，270 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiFeedbackDiagnosticsBuilder.test.ts src/engine/transport/__tests__/transportStateSynchronizer.test.ts src/engine/transport/__tests__/transportFeedbackReporter.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessEffects.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：13 files passed；48 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native`：1 file passed；279 passed
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `xLvYvoQGO1p`，`returnedElapsedMs=2181`
  - 连续召唤 match `-CHFPb4eQOP`，服务端事件间隔 `firstToSecondSummonEventGapMs=1021`
- `npx eslint src\engine\transport\onlineAiRecoveryController.ts src\engine\transport\__tests__\onlineAiRecoveryController.test.ts src\engine\transport\server.ts src\engine\transport\__tests__\server.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecoveryController.test.ts --configLoader native`：1 file passed；4 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "重复恢复|overlay resync|response-loop existing tracker|online AI watchdog 自动反馈冷却期内应按 trackerKey 去重"`：1 file passed；9 passed，270 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts --configLoader native`：4 files passed；17 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native`：1 file passed；279 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts src/engine/transport/__tests__/onlineAiFeedbackDiagnosticsBuilder.test.ts src/engine/transport/__tests__/transportStateSynchronizer.test.ts src/engine/transport/__tests__/transportFeedbackReporter.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessEffects.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：14 files passed；52 passed
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `-XjoQ4trTmi`，`returnedElapsedMs=2645`
  - 连续召唤 match `egI-mGrYz2i`，服务端事件间隔 `firstToSecondSummonEventGapMs=1016`
- `npx eslint src\engine\transport\onlineAiWatchdogSequenceFingerprinting.ts src\engine\transport\__tests__\onlineAiWatchdogSequenceFingerprinting.test.ts src\engine\transport\server.ts src\engine\transport\onlineAiRecoveryController.ts src\engine\transport\__tests__\onlineAiRecoveryController.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts --configLoader native`：2 files passed；7 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "重复恢复|overlay resync|response-loop existing tracker|online AI watchdog 自动反馈冷却期内应按 trackerKey 去重|loop_detected|no_progress|pendingInteractionId 锁住 response window"`：1 file passed；18 passed，261 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts --configLoader native`：5 files passed；20 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native`：1 file passed；279 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts src/engine/transport/__tests__/onlineAiFeedbackDiagnosticsBuilder.test.ts src/engine/transport/__tests__/transportStateSynchronizer.test.ts src/engine/transport/__tests__/transportFeedbackReporter.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessEffects.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：15 files passed；55 passed
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `ifxaa6iYNvI`，`returnedElapsedMs=2415`
  - 连续召唤 match `-m26fDu6Rkm`，服务端事件间隔 `firstToSecondSummonEventGapMs=1019`
- `npx eslint src\engine\transport\server.ts src\engine\transport\onlineAiWatchdogSequenceHelpers.ts src\engine\transport\__tests__\onlineAiWatchdogSequenceHelpers.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogSequenceHelpers.test.ts --configLoader native`：1 file passed；9 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogSequenceHelpers.test.ts src/engine/transport/__tests__/onlineAiWatchdogCandidateValidation.test.ts src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts --configLoader native`：7 files passed；26 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "blocker_persisted|loop_detected|no_progress|重复恢复|response-loop existing tracker|pendingInteractionId 锁住 response window|visible simple-choice 的 option value 漂移|visible simple-choice 的 slider 配置漂移|manual-immediate|confirmed roll"`：1 file passed；22 passed，257 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native`：1 file passed；279 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogSequenceHelpers.test.ts src/engine/transport/__tests__/onlineAiWatchdogCandidateValidation.test.ts src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiWatchdogTracker.test.ts src/engine/transport/__tests__/onlineAiWatchdogScheduling.test.ts src/engine/transport/__tests__/onlineAiRecoveryRuntimeLedger.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts src/engine/transport/__tests__/onlineAiFeedbackDiagnosticsBuilder.test.ts src/engine/transport/__tests__/transportStateSynchronizer.test.ts src/engine/transport/__tests__/transportFeedbackReporter.test.ts src/engine/transport/__tests__/authoritativeCommandSuccessEffects.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandExecutor.test.ts src/engine/transport/__tests__/authoritativeCommandCommit.test.ts src/engine/transport/__tests__/trainingDataCapture.test.ts --configLoader native`：17 files passed；61 passed
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `NhvQ2oS0Hkj`，`returnedElapsedMs=2209`
  - 连续召唤 match `xMx5aBuFXo9`，服务端事件间隔 `firstToSecondSummonEventGapMs=1010`
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "summonerwars 观察到 AI 已恢复|online AI watchdog 在 summonerwars|active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 成功但现场未推进|legal-only 合法动作已把现场切到同一 AI|legal-action-only 且 force fallback 后进入 seat-legal-only|compare-roll visible interaction 尝试恢复后若同一 incident 仍持续"`：1 file passed；10 passed，271 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native`：通过
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `Sp2uzLD1CpM`，`returnedElapsedMs=2494`
  - 连续召唤 match `GhdEyHRZrt2`，服务端事件间隔 `firstToSecondSummonEventGapMs=1007`
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "manual-response-window|legacy response-window|legacyResponseWindowMirror|manual-immediate|confirmed roll|pendingInteractionId 锁住 response window"`：1 file passed；1 passed，280 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native`：49 files passed；598 passed
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `aDgd6JI_KGE`，`returnedElapsedMs=2250`
  - 连续召唤 match `6yA6Pa1KFAp`，服务端事件间隔 `firstToSecondSummonEventGapMs=1013`
- `npx eslint src\engine\transport\server.ts src\engine\transport\onlineAiRecoverySequenceRunner.ts src\engine\transport\onlineAiImmediateExecutionRunner.ts src\engine\transport\__tests__\onlineAiRecoverySequenceRunner.test.ts src\engine\transport\__tests__\onlineAiImmediateExecutionRunner.test.ts src\engine\transport\onlineAiLegalActionRecoveryCoordinator.ts src\engine\transport\__tests__\onlineAiLegalActionRecoveryCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiImmediateExecutionRunner.test.ts src/engine/transport/__tests__/onlineAiRecoverySequenceRunner.test.ts src/engine/transport/__tests__/onlineAiLegalActionRecoveryCoordinator.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts --configLoader native`：4 files passed；10 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "immediate|legal action|private overlay|missing-private-overlay|stale-private-overlay|summonerwars 公开选阵营|summonerwars 观察到 AI 已恢复|online AI watchdog 在 summonerwars|选出的动作若被权威领域状态拒绝|runOnlineAiRecoverySequence|response-loop"`：1 file passed；42 passed，239 skipped
- `npx eslint src\engine\transport\server.ts src\engine\transport\onlineAiRecoveryCandidateResolver.ts src\engine\transport\onlineAiManualRecoveryCoordinator.ts src\engine\transport\__tests__\onlineAiRecoveryCandidateResolver.test.ts src\engine\transport\__tests__\onlineAiManualRecoveryCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecoveryCandidateResolver.test.ts src/engine/transport/__tests__/onlineAiManualRecoveryCoordinator.test.ts --configLoader native`：2 files passed；7 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "manual-setup-selection|manual-force-end-ai-phase|manual-response-window|legacy response-window|immediate|legal action|private overlay|missing-private-overlay|stale-private-overlay|summonerwars 公开选阵营|summonerwars 观察到 AI 已恢复|online AI watchdog 在 summonerwars|response-loop"`：1 file passed；41 passed，240 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native`：通过（Phase 22 / 23 后完整 transport suite，exit code 0）
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `D9pgSMCa-Mm`，`returnedElapsedMs=2371`
  - 连续召唤 match `aiFBp70ofKg`，服务端事件间隔 `firstToSecondSummonEventGapMs=1020`
- `npx eslint src\engine\transport\server.ts src\engine\transport\onlineAiRepeatedRecoveryCoordinator.ts src\engine\transport\__tests__\onlineAiRepeatedRecoveryCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRepeatedRecoveryCoordinator.test.ts src/engine/transport/__tests__/onlineAiRepeatedRecoveryUnblockExecutor.test.ts src/engine/transport/__tests__/onlineAiRecoveryController.test.ts --configLoader native`：3 files passed；8 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "重复恢复|repeated|force-unblocked|suppressed|overlay resync|response-loop existing tracker|online AI watchdog 自动反馈冷却期内应按 trackerKey 去重"`：1 file passed；9 passed，272 skipped
- `npx eslint src\engine\transport\server.ts src\engine\transport\onlineAiCircuitFailureCoordinator.ts src\engine\transport\__tests__\onlineAiCircuitFailureCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiCircuitFailureCoordinator.test.ts src/engine/transport/__tests__/onlineAiCircuitBreaker.test.ts src/engine/transport/__tests__/onlineAiCircuitFeedbackDiagnostics.test.ts --configLoader native`：3 files passed；7 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "circuit|熔断|stale state|stale_state|online AI command rejected|在线 AI|watchdog 自动反馈冷却期"`：1 file passed；5 passed，276 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\transportSocketRouter.ts src\engine\transport\onlineAiClientTransportDiagnostics.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "教程 AI 裸 RESPOND|在线 socket command 入口不应接受 __internalPlayerId|在线非教程命令即使带 __tutorialPlayerId"`：1 file passed；3 passed，278 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\matchConnectionLifecycleCoordinator.ts src\engine\transport\__tests__\matchConnectionLifecycleCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/matchConnectionLifecycleCoordinator.test.ts --configLoader native`：1 file passed；8 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "offline adjudication|离线裁决|sync should reject stale credentials|player:connected|player:disconnected|disconnect|spectator"`：1 file passed；7 passed，274 skipped
- `npx eslint src\engine\transport\server.ts src\engine\transport\matchRoomRegistry.ts src\engine\transport\__tests__\matchRoomRegistry.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/matchRoomRegistry.test.ts --configLoader native`：1 file passed；5 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server-injectState.test.ts --configLoader native`：1 file passed；5 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "sync|offline adjudication|离线裁决|unload|disconnect|validateTestAccess|match_not_found"`：1 file passed；16 passed，265 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\matchRoomUnloadCoordinator.ts src\engine\transport\__tests__\matchRoomUnloadCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/matchRoomUnloadCoordinator.test.ts --configLoader native`：1 file passed；4 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "unload|已卸载|销毁活跃房间|match_not_found|disconnect"`：1 file passed；2 passed，279 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\authoritativeCommandFailureCoordinator.ts src\engine\transport\__tests__\authoritativeCommandFailureCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeCommandFailureCoordinator.test.ts --configLoader native`：1 file passed；3 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "pipeline 异常|领域拒绝|batch 内|命令验证失败|自动上报后台反馈|失败命令应记录实际参数|command failure"`：1 file passed；6 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\authoritativeCommandStaleRejectionCoordinator.ts src\engine\transport\__tests__\authoritativeCommandStaleRejectionCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeCommandStaleRejectionCoordinator.test.ts --configLoader native`：1 file passed；3 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "stale_state|stale state|expectedStateID|online AI command rejected|circuit|命令验证失败|command failure"`：1 file passed；3 passed，278 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\authoritativeCommandSuccessCoordinator.ts src\engine\transport\__tests__\authoritativeCommandSuccessCoordinator.test.ts src\engine\transport\authoritativeCommandStaleRejectionCoordinator.ts src\engine\transport\__tests__\authoritativeCommandStaleRejectionCoordinator.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeCommandSuccessCoordinator.test.ts src/engine/transport/__tests__/authoritativeCommandStaleRejectionCoordinator.test.ts --configLoader native`：2 files passed；6 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "unsatisfiable-interaction-auto-skipped|gameover|训练|training|batch expectedStateID|batch 内|human 单条命令|领域拒绝|自动上报后台反馈|命令验证失败"`：1 file passed；12 passed，269 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `node scripts\infra\run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `oTkTqvptFry`，`returnedElapsedMs=2507`
  - 连续召唤 match `1Yd7zMwaIOw`，服务端事件间隔 `firstToSecondSummonEventGapMs=1011`
- `npx eslint src\engine\transport\server.ts src\engine\transport\authoritativeBatchCoordinator.ts src\engine\transport\authoritativeCommandQueue.ts src\engine\transport\__tests__\authoritativeBatchCoordinator.test.ts src\engine\transport\__tests__\authoritativeCommandQueue.test.ts src\engine\transport\__tests__\matchRoomRuntime.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeBatchCoordinator.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts src/engine/transport/__tests__/matchRoomRuntime.test.ts --configLoader native`：3 files passed；15 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "batch expectedStateID|batch 内|batch rejected|batch:confirmed|命令验证失败|pipeline 异常"`：1 file passed；5 passed，276 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\authoritativeQueuedCommandStaleRejectionCoordinator.ts src\engine\transport\__tests__\authoritativeQueuedCommandStaleRejectionCoordinator.test.ts src\engine\transport\authoritativeCommandQueue.ts src\engine\transport\__tests__\authoritativeCommandQueue.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeQueuedCommandStaleRejectionCoordinator.test.ts src/engine/transport/__tests__/authoritativeCommandQueue.test.ts --configLoader native`：2 files passed；8 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "排队后因权威状态前进而丢弃"`：1 file passed；1 passed，280 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0
- `npx eslint src\engine\transport\server.ts src\engine\transport\matchSetupStateFactory.ts src\engine\transport\trackedRandom.ts src\engine\transport\matchRoomRegistry.ts src\engine\transport\__tests__\matchSetupStateFactory.test.ts src\engine\transport\__tests__\matchRoomRegistry.test.ts`：通过
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/matchSetupStateFactory.test.ts src/engine/transport/__tests__/matchRoomRegistry.test.ts --configLoader native`：2 files passed；10 passed
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "setupMatch"`：1 file passed；5 passed，276 skipped
- `node scripts\infra\vitest-cli-safe.mjs run src/engine/transport/__tests__ --configLoader native --reporter=dot`：完整 transport suite 通过，exit code 0

## 当前限制

- 这不是最终完成状态；`server.ts` 仍然过大，broadcast / gameover 的外部 adapter、健康检查 / 启停和部分命令入口组装仍需继续迁到正式运行时模块。
- 这不是“所有游戏全量回归”；当前只证明状态同步、房间运行时、在线 AI recovery/circuit 代表合同和此前 Summoner Wars 在线 AI 代表链未被本轮已完成切口破坏。
- 本轮 setup state factory 未触碰 Summoner Wars 页面节奏主链或 AI recovery 主循环，因此本次只补模块直测、server 定向和完整 transport suite；此前 Summoner Wars E2E 结果不能外推为所有游戏全量回归。
- `npx tsc --noEmit --project tsconfig.server.json` 当前会命中大量既有历史类型错误，不能作为本轮改动的有效完成门禁；本轮用定向 lint + transport 测试证明改动面。
