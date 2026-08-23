# Transport Room Runtime Refactor

日期：2026-08-20
角色：重构记录，不是通用规范。AI 规范仍以 `.spec/` 为准。

## 目标

把 `GameTransportServer` 从单个上帝服务对象拆成可审查的传输房间运行时。目标不是按行数机械拆，而是收敛职责所有权：

| 职责 | 目标边界 |
| --- | --- |
| 房间生命周期 | load / getOrLoad / unload、连接、断线、离线裁决 |
| 权威命令执行 | 串行锁、队列、batch、rollback、stale 拒绝、持久化 |
| 状态投影与同步 | `playerView`、传输裁剪、patch / full update、广播 |
| 在线 AI 控制器 | immediate、watchdog、恢复序列、合法动作兜底 |
| 诊断反馈 | 命令失败、AI 恢复、circuit breaker 反馈 |
| 训练数据 | 决策样本、完成对局提交、失败隔离 |

## 当前状态

- `src/engine/transport/server.ts` 本轮开始约 5611 行，当前约 1807 行。
- socket route、连接 / 断线生命周期、房间注册表 / load 构造、卸载编排、命令失败收口、stale 拒绝、成功命令收口、batch 收口、setup 状态构造和测试 / 管理状态注入已迁出。
- `server.ts` 仍保留广播 / gameover 外部 adapter、健康检查 / 启停和部分命令入口组装；不能宣称重构完成。
- `src/engine/transport/__tests__/server.test.ts` 仍是集中测试文件，约 30682 行；测试侧还需要继续拆合同。
- 具体游戏的大模块问题只登记为后续候选，不并入本轮 transport runtime 重构。

## 目标形态

```text
GameTransportServer
  -> socket namespace / auth / runtime registry adapter
MatchRoomRegistry
  -> active match registry / load / unload / metadata cache
MatchRoomRuntime
  -> 单房间权威状态 / 命令锁 / 队列 / 持久化 / 广播出口
AuthoritativeCommandExecutor
  -> executePipeline / stale 拒绝 / batch / rollback / gameover 回调
TransportStateProjection
  -> playerView / transport stripping / patch / full update
OnlineAiRecoveryController
  -> immediate / watchdog / recovery sequence / repeated unblock
TransportFeedbackReporter
  -> command failure / AI recovery / circuit feedback
TrainingDataCapture
  -> decision sample / completed match / discard policy
```

## 已落地模块

| 模块 | 承接职责 |
| --- | --- |
| `stateProjection.ts` | 传输裁剪、训练裁剪、玩家视图、广播投影 |
| `transportStateSynchronizer.ts` | 状态同步协调 |
| `engineConfig.ts` | 引擎配置与 telemetry 类型合同 |
| `authoritativeCommandExecutor.ts` | 单命令进入权威 pipeline |
| `authoritativeBatchExecutor.ts` | batch 事务执行与回滚 |
| `authoritativeCommandCommit.ts` | 成功命令提交、stateID、持久化和成功回调 |
| `authoritativeCommandQueue.ts` | 单房间命令 / batch 串行队列 |
| `matchRoomRuntime.ts` | 单房间执行锁、队列入口和运行时 facade |
| `trainingDataCapture.ts` | 训练数据采集、过滤、提交和丢弃 |
| `transportFeedbackReporter.ts` | 系统反馈上报、冷却去重和默认 reporter |
| `onlineAiFeedbackDiagnosticsBuilder.ts` | AI / 命令失败反馈 payload 构造 |
| `onlineAiRecoveryRuntimeLedger.ts` | recovery tracker、in-flight、重复恢复、overlay 冷却账本 |
| `onlineAiWatchdogTracker.ts` / `onlineAiWatchdogScheduling.ts` | watchdog tracker 与调度决策 |
| `onlineAiRecoveryController.ts` | watchdog tick 与跨房间恢复调度 |
| `onlineAiWatchdogSequenceFingerprinting.ts` | recovery 进度身份和 semantic fingerprint |
| `onlineAiWatchdogSequenceHelpers.ts` | sequence 阶段决策、收口、特例判断 |
| `onlineAiLegalActionRecoveryCoordinator.ts` | legal-action recovery 协调 |
| `onlineAiRecoverySequenceRunner.ts` | recovery sequence 主体 |
| `onlineAiImmediateExecutionRunner.ts` | immediate AI 执行 |
| `onlineAiRecoveryCandidateResolver.ts` | recovery candidate 解析 |
| `onlineAiManualRecoveryCoordinator.ts` | manual recovery 请求协调 |
| `onlineAiRepeatedRecoveryCoordinator.ts` | repeated recovery 与 unblock |
| `onlineAiCircuitFailureCoordinator.ts` | circuit failure 上报协调 |
| `transportSocketRouter.ts` | socket command / sync route |
| `onlineAiClientTransportDiagnostics.ts` | 客户端 AI transport 诊断 |
| `matchConnectionLifecycleCoordinator.ts` | connect / disconnect / spectator / offline adjudication |
| `matchRoomRegistry.ts` | 房间 registry、load、get、unload cache |
| `matchRoomUnloadCoordinator.ts` | unload 清理 |
| `authoritativeCommandFailureCoordinator.ts` | 命令失败反馈与拒绝收口 |
| `authoritativeCommandStaleRejectionCoordinator.ts` | 单命令 stale 拒绝 |
| `authoritativeCommandSuccessCoordinator.ts` | 成功命令后置效果 |
| `authoritativeBatchCoordinator.ts` | batch socket 确认 / 拒绝协调 |
| `authoritativeQueuedCommandStaleRejectionCoordinator.ts` | 排队命令 stale 拒绝 |
| `matchSetupStateFactory.ts` | setup 初始状态构造 |
| `matchStateInjectionCoordinator.ts` | 测试 / 管理状态注入协调 |

## 下一批切口

1. 继续瘦 `server.ts`：广播 / gameover 外部 adapter、健康检查 / 启停、剩余命令入口组装。
2. 继续拆 `server.test.ts`：把私有方法式断言迁到模块合同测试。
3. 房间运行时边界完成后，再评估单游戏大模块；不要把游戏专项重构混进 transport 主线。

## 禁止路线

- 不把 `server.ts` 原样搬成另一个同等大小的 god object。
- 不新增第二套房间状态、第二套 AI truth 或第二套广播 truth。
- 不用 helper 包装替代职责归属；helper 必须有明确 owner。
- 不用单个代表 E2E 外推所有游戏全量回归。
- 不把 TypeScript 既有历史错误当作本轮重构是否成立的唯一门禁。

## 验收口径

| 风险 | 验证 |
| --- | --- |
| 权威命令 / batch / queue | 模块直测 + `server.test.ts` 代表命令链 |
| 房间 lifecycle | registry / connection / unload 模块直测 + server 定向 |
| 在线 AI recovery | recovery 模块直测 + server 定向 + 代表真实 E2E |
| 反馈 / 训练数据 | reporter / diagnostics / capture 模块直测 |
| socket route | socket router 定向测试 |

最新有效摘要：

- transport 模块测试 suite 已通过。
- `server.test.ts` 定向与完整代表集已通过。
- 代表在线 AI 真实 E2E 已通过。
- 定向 `eslint` 已通过。
- `tsconfig.server.json` 的 `tsc --noEmit` 仍命中既有历史类型错误，当前不作为本轮完成门禁。

详细逐命令历史不再写进本文；需要审计时查 git 历史和对应测试输出。

## 当前限制

- 重构未完成，`server.ts` 仍然过大。
- 当前证据只证明 transport 状态同步、房间运行时、在线 AI recovery / circuit 代表合同未退化。
- 不能从本文件外推为所有游戏全量回归。
