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

- `src/engine/transport/server.ts` 在本轮开始时约 5611 行；当前约 5361 行，仍包含房间、命令、队列、在线 AI、反馈和部分运行时提交职责。
- `runOnlineAiRecoverySequence` 仍超过 1000 行，是在线 AI 恢复控制器的主要迁移对象。
- `src/engine/transport/__tests__/server.test.ts` 超过 28000 行，说明测试合同也已经过度集中。
- Summoner Wars 当前受影响最大，在线 AI 验收必须覆盖 `server.test.ts` 的 Summoner Wars watchdog/即时 AI 合同，并继续使用真实 E2E 回归。

## 仓库级扫描结论

本轮不是只看 `server.ts`。按 2026-08-20 的仓库扫描，当前至少有四类同源架构债：

1. **传输运行时上帝对象**
   - `src/engine/transport/server.ts` 当前仍约 5361 行。
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
- `server.ts` 当前仍同时拥有房间注册、socket route、状态写入、队列、恢复、反馈、训练数据、投影广播，属于上帝对象，不符合健康服务端运行时设计。
- `server.test.ts` 是同一个问题在测试侧的镜像：测试跨过正式边界直接访问私有方法，说明可验证合同还没有被新模块接口承载。
- Summoner Wars 不是 transport 重构的旁观者。它当前受在线 AI 节奏和恢复链影响最大，因此后续每一刀都必须至少保留一条 Summoner Wars 在线 AI 验收。

## 目标形态

```text
GameTransportServer
  - socket 事件路由
  - 房间注册表
  - 认证入口

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
- 尚未完成：stale precondition、执行锁 / queue、广播出口、gameover callback、命令失败反馈仍在 `server.ts`，下一步应继续迁到房间运行时或命令运行时，而不是继续堆在 socket route 层。
- 玩家命令、在线 AI 命令、batch 命令仍必须共用这一条唯一权威写入口。
- 不允许为 AI 或 batch 新增第二套状态写入、第二套 rollback 或第二套 failure reason 解释。
- 验收：新增 executor 直测；保留 `server.test.ts` 中 stale、batch、command failure、training sample 代表合同。

### Phase 2：房间运行时

- 抽 `MatchRoomRuntime`，持有单房间 active state、执行锁、commandQueue、metadata merge、load/unload、broadcast adapter。
- `GameTransportServer` 收缩为 socket 事件路由、认证入口、runtime registry。
- 离线裁决和 disconnect lifecycle 跟房间运行时走，不留在 socket route 层。
- 验收：同步/重连/离座/卸载/队列合同迁到 runtime 测试；`server.test.ts` 只保留 socket route 集成合同。

### Phase 3：在线 AI 控制器

- 抽 `OnlineAiRecoveryController`，迁出 immediate AI、watchdog tick、candidate revalidation、recovery sequence、repeated recovery unblock。
- 控制器只能通过 `MatchRoomRuntime` 暴露的读状态、执行命令、广播、反馈接口工作，不能直接拥有 socket map、storage map 或 active match registry。
- 先迁控制器壳和执行依赖，再迁 `runOnlineAiRecoverySequence` 主体；不要把 1000+ 行函数原样搬家后宣称完成。
- 验收：watchdog 直测覆盖 human guard、AI current + human responder、hidden interaction、private overlay stale/missing；Summoner Wars 真实 E2E 必跑。

### Phase 4：反馈与训练数据

- 抽 `TransportFeedbackReporter`，承接 command failure、online AI recovery、circuit breaker 的 payload、冷却、默认 HTTP reporter。
- `TrainingDataCapture` 已落地，后续只需在 `MatchRoomRuntime` 接管命令提交后把调用点随提交合同迁移。
- 这两层只能消费执行结果和运行时快照，不能反向拥有状态推进能力。
- 验收：已有 `commandFailureFeedbackPayload`、`onlineAiCircuitFeedbackDiagnostics`、`onlineAiUnsatisfiableInteraction` 测试继续保留；新增 reporter/capture 合同测试。

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
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "stale_state|batch 内|command failure|AI seat-view 只剩 emergency skip|Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"`：13 passed，268 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "成功命令后应采集训练决策样本|training recorder 失败不应影响命令执行|默认应跳过 AI seat 的训练样本|每游戏配置"`：3 passed，278 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "刷新房间摘要"`：1 passed，280 skipped
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "成功命令后应采集训练决策样本|training recorder 失败不应影响命令执行|未完成对局即使超过时长门槛|完整对局低于时长门槛|默认应跳过 AI seat|manifest 声明 all-seats|刷新房间摘要|stale_state|batch 内|command failure|AI seat-view 只剩 emergency skip|Summoner Wars 即时服务端 AI|summonerwars 公开选阵营|online AI watchdog 在 summonerwars"`：1 file passed；20 passed，261 skipped
- `node scripts/infra/run-e2e-single.mjs isolated e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`：2 passed
  - 空回合 match `P5OSrGiVDTW`，`returnedElapsedMs=2545`
  - 连续召唤 match `bMhe7c2ecMX`，服务端事件间隔 `firstToSecondSummonEventGapMs=1011`
- `npm run audit:evidence:selfcheck -- evidence\engine\online-ai-visible-delay-budget-2026-08-19.md evidence\summonerwars\summonerwars-online-ai-delay-2026-08-19.md`：OK

## 当前限制

- 这不是最终完成状态；`server.ts` 仍然过大，`runOnlineAiRecoverySequence` 仍需迁到在线 AI 控制器。
- 这不是“所有游戏全量回归”；当前只证明状态投影合同和 Summoner Wars 在线 AI 代表合同未被本轮两刀破坏。
- `npx tsc --noEmit --project tsconfig.server.json` 当前会命中大量既有历史类型错误，不能作为本轮改动的有效完成门禁；本轮用定向 lint + transport 测试证明改动面。
