# 在线 AI 可见动作节奏修复证据（2026-08-19）

## 1. 基本信息

- 对象：服务端在线 AI 自动执行链的可见动作等待。
- 日期：2026-08-19。
- 作者：Codex。
- 文档类型：closeout。
- 关联症状：用户反馈在线 AI “别说一秒，直接卡死 / 等了很久 / 没用白名单吗”，并澄清 DiceThrone 只是刚刚触发点，Summoner Wars 当前影响最大。

## 2. 审计范围

- 本轮覆盖模块：`src/engine/transport/server.ts`、`src/engine/transport/onlineAiActionDelay.ts`、`src/engine/transport/onlineAiExecutor.ts`、`src/engine/transport/onlineAiSeatControllers.ts`、`src/engine/transport/onlineAiRecoveryOwnership.ts`、`src/engine/transport/onlineAiRecoveryResolved.ts`、`src/engine/transport/onlineAiRecoveryDispatch.ts`、`src/engine/transport/commandFailureReason.ts`、`src/engine/transport/onlineAiLegalActionCommand.ts`、`src/engine/transport/onlineAiLegalActionRecoveryExecutor.ts`、`src/engine/transport/onlineAiRepeatedRecoveryUnblockExecutor.ts`、`src/engine/transport/onlineAiWatchdogSequenceFingerprinting.ts`、`src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts`、`src/engine/transport/__tests__/onlineAiExecutor.test.ts`、`src/engine/transport/__tests__/onlineAiRecoveryOwnership.test.ts`、`src/engine/transport/__tests__/onlineAiRecoveryDispatch.test.ts`、`src/engine/transport/__tests__/commandFailureReason.test.ts`、`src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts`、`src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts`、`src/engine/transport/__tests__/onlineAiRepeatedRecoveryUnblockExecutor.test.ts`、`src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts`、`src/engine/transport/__tests__/onlineAiWatchdogFeedbackDiagnostics.test.ts`、`src/engine/transport/__tests__/server.test.ts`、`e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`。
- 本轮覆盖链路：服务端在线 AI 即时执行入口和 watchdog legal-action 恢复入口。
- 本轮真实入口 / 环境：Summoner Wars 在线房间，`seatControllers['1'] = local-ai`，`minimumActionDelayMs = 1000`，服务端权威执行 AI。
- 明确不覆盖：所有游戏完整 AI 策略质量、所有游戏逐个真实 E2E、视觉动效产品级调优。

## 3. 结论等级

- 结论：功能实现已验证。
- 判定理由：服务端在线 AI 已按游戏 runtime 白名单判断可见 / 静默动作；连续可见动作改为按“上一次可见动作成功完成时间”重新计时。Summoner Wars 真实在线 E2E 通过，连续两次可见召唤的服务端事件间隔为 1020ms。

## 4. 根因分层

- 现实故障现象：Summoner Wars 在线房间里，AI 连续可见召唤会几乎同时出现在玩家视角里，第二个可见动作没有 1 秒节奏。
- 直接触发条件：当前执行权属于服务端在线 AI（页面运行权归属日志显示 `server-online-ai-executor`），而服务端连续动作处在同一个自动执行片段内。
- 止血 / 恢复动作：服务端提交 AI 命令前先调用共享动作可见性和延迟计划；等待过程中若状态编号变化、对局卸载或座位改成人类，丢弃旧 AI 命令。
- 根本机制：此前服务端用“同一自动片段共享可见等待预算”记录第一次可见动作的等待开始时间。第一步等满 1000ms 后，第二步用同一个起点抵扣，导致第二个可见动作 `remainingDelayMs = 0`。这和重构前浏览器本地 AI 的“上一个可见动作成功提交后再开始下一次计时”不一致。

## 5. 实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| runtime 白名单 | 有游戏 runtime 白名单时，服务端必须优先按白名单判定可见动作，不能让通用 `advance-phase` 默认越权 | `resolveLocalAiActionVisibility()`；`onlineAiActionDelay.waitForOnlineAiActionDelay()` | Summoner Wars `summon-unit` 为 visible；普通非白名单动作为 hidden；draw 阶段可用 metadata 显式 visible | `server.test.ts` runtime 白名单与 Summoner Wars 可见动作单测 | 通过 |
| 连续可见动作 | 同一自动执行片段内，第二个可见动作也必须按上一个可见动作完成时间重新等待 | `OnlineAiActionDelayContext.lastVisibleActionAt`；`onlineAiActionDelay.markOnlineAiVisibleActionCompleted()` | 两次 `summon-unit` 都触发 `online-ai-delay-started`，各自等待 1000ms | `Summoner Wars 即时服务端 AI 同一自动片段里的连续可见动作应按上次可见完成时间重新等待` | 通过 |
| 状态变化保护 | AI 等待期间如果状态被其它命令改变，旧 AI 命令不得继续提交 | `stateIDBeforeDelay` 与最新 seat controller 复查 | 等待后只在对局仍是同一状态且 seat 仍是 AI 时执行 | `server.ts` 即时执行和 recovery 执行入口共用复查 | 通过 |
| 即时 AI executor 拆分 | 重构不得改 AI 决策、命令序列、广播和恢复状态收口语义 | `onlineAiExecutor.tryExecuteOnlineAiImmediateAction()` 只通过注入的 playerView、seat controller、命令序列和广播入口工作 | `GameTransportServer` 仍掌握锁、队列、存储、恢复 tracker 和 broadcast；executor 只承载即时动作流程 | lint、Summoner Wars 窄单测、真实 E2E | 通过 |
| AI seat controller 解析拆分 | setupData 明确禁用 AI 时必须按 human；setupData 与 state/core 中的 seatControllers 仍要合并供 watchdog 和即时执行消费 | `onlineAiSeatControllers.ts` 集中承载 raw 提取、manifest 归一化、训练分类和 watchdog seat map 构造 | Summoner Wars 在线 E2E 仍识别 `seatControllerTypes={"0":"human","1":"local-ai"}`，执行权仍为服务端在线 AI | lint、Summoner Wars 窄单测、真实 E2E | 通过 |
| 命令序列事务拆分 | 即时 AI 命令序列失败时，必须回滚已执行命令造成的 state/stateID/random cursor/lastCommandPlayerId/cache，并保留真实失败原因 | `onlineAiExecutor.executeOnlineAiCommandSequence()` | 第二条命令失败时第一条命令副作用回滚，`lastCommandFailureReason` 保留失败原因，存储回写并广播恢复态 | `onlineAiExecutor.test.ts` | 通过 |
| recovery ownership 拆分 | watchdog legal-action 多命令执行时，第一条命令后若控制权已交回 human 或其它窗口，不得继续代 AI 执行后续命令 | `onlineAiRecoveryOwnership.isOnlineAiRecoveryStillOwnedByAi()` | shared interaction、hidden interaction、response window、当前 AI 玩家 fallback 的归属判断保持原语义 | `onlineAiRecoveryOwnership.test.ts`；`server.test.ts` 多命令 legal-action owner changed 回归 | 通过 |
| recovery resolved 拆分 | watchdog 判断“卡点是否已解除”时必须保持 legal-only、visible/hidden interaction、response-window、人类响应窗口强关例外的旧语义 | `onlineAiRecoveryResolved.resolveOnlineAiRecoveryResolved()` | `server.ts` 只注入当前状态、候选重算和 playerView；测试入口 `hasOnlineAiRecoveryResolved()` 保持不变 | `server.test.ts` targeted resolved / recovery 回归 | 通过 |
| recovery dispatch 拆分 | watchdog legal-action 应先用 strict 在线决策视图，只有 stale/missing private overlay 且 candidate reason 允许时才用 emergency playerView 重试；response-loop 经 emergency 后仍 blocked 不触发 overlay resync | `onlineAiRecoveryDispatch.resolveOnlineAiRecoveryDispatch()` | `server.ts` 仍保留执行、延迟、广播、tracker、feedback 和持久化；dispatch 模块只返回 `action / blocked / no-legal-action` | `onlineAiRecoveryDispatch.test.ts`；`server.test.ts` targeted recovery 回归 | 通过 |
| 命令失败原因拆分 | 命令失败原因格式化、截断、自动上报判定和严重级别必须保持同一合同，避免 `server.ts` 分散维护 | `commandFailureReason.ts` | 玩家命令仍只自动上报通用 / pipeline 失败；online AI watchdog 失败仍始终允许自动上报；重复原因不重复拼接 | `commandFailureReason.test.ts`；`server.test.ts` 权威预检失败回归 | 通过 |
| legal-action 权威预检拆分 | watchdog legal-action 执行前，普通命令必须用当前权威状态 validate；系统恢复命令不走领域 validate；validate 抛错时仍交给正式管线处理 | `onlineAiLegalActionCommand.precheckOnlineAiAuthoritativeCommand()` | `server.ts` 只负责失败现场记录、circuit 记账、反馈和执行管线；预检模块只返回 `valid / skipped / invalid / deferred` | `onlineAiLegalActionCommand.test.ts`；`server.test.ts` 权威预检失败回归 | 通过 |
| legal-action 执行器拆分 | watchdog legal-action 的可见等待、命令串行执行、权威预检、执行后归属复查、无进展判定和最终广播必须保持旧合同 | `onlineAiLegalActionRecoveryExecutor.executeOnlineAiLegalActionRecovery()` | `server.ts` 只注入 seat controller、playerView、validate、execute、broadcast、tracker、circuit 和 feedback hooks；执行器不拥有房间状态写入口 | `onlineAiLegalActionRecoveryExecutor.test.ts`；`server.test.ts` targeted legal-action 回归 | 通过 |
| repeated recovery 强制解卡拆分 | 同一卡点重复恢复达到上限后，只能在 AI seat 且无响应窗口时取消当前 AI interaction，再按正式 phase advance 规则推进；有 response window 时不得裸推进 | `onlineAiRepeatedRecoveryUnblockExecutor.tryForceUnblockRepeatedOnlineAiRecovery()` | `server.ts` 只注入 circuit、命令执行、suppressed/force-unblocked feedback、tracker 清理和队列 drain；执行器不拥有第二套房间状态写入口 | `onlineAiRepeatedRecoveryUnblockExecutor.test.ts`；`server.test.ts` repeated recovery targeted 回归 | 通过 |
| recovery fingerprint 迁移 | 同一 AI 卡点的 tracker key、feedback blocker fingerprint 和状态 fallback fingerprint 必须继续使用同一语义，不因拆分改变去重和诊断定位 | `onlineAiWatchdogSequenceFingerprinting.ts` | `server.ts` 只保留兼容测试入口的薄包装；真实 fingerprint 生成、tracker key 提取和 private overlay 失败后缀归入现有 fingerprint 模块 | `onlineAiWatchdogSequenceFingerprinting.test.ts`；`server.test.ts` fingerprint targeted 回归 | 通过 |
| feedback 诊断格式迁移 | 自动反馈里的 action log tail、event stream tail、interaction options、responseWindow、pendingDamage、commandPayload 和 blockerFingerprint 必须保持同一 JSON 诊断格式 | `onlineAiWatchdogFeedbackDiagnostics.buildOnlineAiDiagnosticActionLog()`；`onlineAiWatchdogFeedbackDiagnostics.buildOnlineAiWatchdogBlockerFingerprint()` | `server.ts` 不再本地维护纯诊断 JSON 和 blocker fingerprint 拼接；诊断模块复用 action/event tail 提取、结构化克隆和 fingerprint 归一化，不拥有状态写入口、tracker 或 feedback 入库权 | `onlineAiWatchdogFeedbackDiagnostics.test.ts`；`server.test.ts` targeted feedback / blocker 回归 | 通过 |
| Summoner Wars 真实入口 | 连续两次可见召唤之间应保留约 1 秒节奏 | Summoner Wars 在线 E2E | match `UpA4UAe3ZXb`：召唤事件间隔 `1020ms`；页面轮询采样间隔 `1065ms`，不作为节奏断言权威 | `e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts` | 通过 |

## 6. AI-only guard

- 只读取 AI seat 控制配置；human seat 不进入服务端 AI 命令执行。
- 等待结束后再次检查对局状态编号和座位控制者，避免旧 AI 命令覆盖真人后续操作。
- hidden、执行失败、状态变化中断、human 接管不会更新时间；只有成功执行的 visible 动作才更新 `lastVisibleActionAt`。

## 7. 共享流程审计

| sharedFlowId | 流程职责 | 不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- |
| `online-ai-visible-action-interval-v2` | 服务端在线 AI 提交命令前按 runtime 判定动作可见性，并在可见动作成功完成后记录下一次等待起点 | 只延迟 visible；hidden 为 0ms；连续 visible 之间按完成时间重新计时；状态变化后丢弃旧命令 | 每游戏 `defaultMinimumActionDelayMs`、`localVisibleStepDelayConfig.actionKinds`、单动作 metadata policy | 共享流程失效会影响所有服务端在线 AI；runtime 配置错误只影响对应游戏 |

代表对象：Summoner Wars 在线房间的 AI seat 1。判等依据：这条真实入口消费同一个 `runOnlineAiImmediateExecution()`、`waitForOnlineAiActionDelay()`、`resolveLocalAiActionVisibility()` 链路，没有 Summoner Wars 私有服务端分支；游戏差异只来自 runtime 的可见动作白名单和默认等待时长。

## 8. 重构记录

- 第一刀：`onlineAiActionDelay.ts` 成为在线 AI 可见动作延迟的唯一模块，承载动作可见性、等待计划、等待日志和 visible 完成时间更新。
- 第二刀：`onlineAiExecutor.ts` 承载即时 AI 动作解析与命令序列执行编排，`server.ts` 只注入 playerView、最新 seat controller、命令执行、恢复状态清理和广播入口。
- 第三刀：`onlineAiSeatControllers.ts` 承载 setupData / state seat controller 提取、manifest 归一化、训练分类和 watchdog seat map 构造，避免 `server.ts` 继续散落“谁是 AI seat”的解析规则。
- 第四刀：`onlineAiExecutor.executeOnlineAiCommandSequence()` 承载即时 AI 命令序列事务，包括成功 stateChanged 判定、失败回滚、存储回写、广播恢复态和失败原因保留。
- 第五刀：`onlineAiRecoveryOwnership.ts` 承载 watchdog legal-action 执行多条命令时的“是否仍由同一 AI seat 拥有恢复动作”判断；`server.ts` 仍保留执行、广播、tracker、feedback 和持久化所有权。
- 第六刀：`onlineAiRecoveryResolved.ts` 承载 watchdog 恢复后 resolved 判定；`server.ts` 仍保留候选重算入口和 playerView 注入，避免 resolved 逻辑继续埋在巨型类里。
- 第七刀：`onlineAiRecoveryDispatch.ts` 承载 watchdog legal-action 的 strict 决策、emergency playerView 重试、blocked 分类和 overlay resync 建议；`server.ts` 仍掌握真实命令执行与房间状态写入。
- 第八刀：`commandFailureReason.ts` 承载命令失败原因格式化和自动上报判定；`onlineAiLegalActionCommand.ts` 承载 watchdog legal-action 的权威命令预检。`server.ts` 仍掌握真实失败现场、circuit 记账、反馈、命令执行和状态写入。
- 第九刀：`onlineAiLegalActionRecoveryExecutor.ts` 承载 watchdog legal-action 的等待、命令串行执行、执行后归属复查、无进展判定、resolved 收口与 visible 完成时间更新；`server.ts` 只提供服务端 hooks，不新增第二套 tracker、feedback 或状态写入口。
- 第十刀：`onlineAiRepeatedRecoveryUnblockExecutor.ts` 承载 repeated recovery 到达上限后的强制解卡执行，包括 AI interaction 安全取消、phase advance、circuit safe-unblock、suppressed/force-unblocked 上报和队列 drain；`server.ts` 只提供服务端 hooks，不新增第二套房间状态、tracker、feedback 或 broadcast 真相。
- 第十一刀：`onlineAiWatchdogSequenceFingerprinting.ts` 接管 `server.ts` 内原本重复维护的 recovery fingerprint、tracker key 提取和 feedback blocker fingerprint 失败后缀；`server.ts` 仅保留薄包装以兼容现有测试入口。
- 第十二刀：`onlineAiWatchdogFeedbackDiagnostics.ts` 承接 action/event tail 提取和自动反馈 diagnostic actionLog JSON 构造；`server.ts` 不再维护这份纯诊断格式，仍只负责何时上报和状态写入。
- 第十三刀：删除 `server.ts` 内重复的 blocker fingerprint 纯诊断构造，统一调用 `onlineAiWatchdogFeedbackDiagnostics.buildOnlineAiWatchdogBlockerFingerprint()`；两个原调用点保留原参数和上报时机，不改变 feedback 入库、tracker 或恢复执行语义。
- 当前行数：`server.ts = 6333`，`onlineAiSeatControllers.ts = 145`，`onlineAiExecutor.ts = 285`，`onlineAiActionDelay.ts = 109`，`onlineAiRecoveryOwnership.ts = 60`，`onlineAiRecoveryResolved.ts = 178`，`onlineAiRecoveryDispatch.ts = 130`，`commandFailureReason.ts = 68`，`onlineAiLegalActionCommand.ts = 58`，`onlineAiLegalActionRecoveryExecutor.ts = 203`，`onlineAiRepeatedRecoveryUnblockExecutor.ts = 255`，`onlineAiWatchdogSequenceFingerprinting.ts = 203`，`onlineAiWatchdogFeedbackDiagnostics.ts = 441`，`onlineAiRecoveryDispatch.test.ts = 226`，`commandFailureReason.test.ts = 46`，`onlineAiLegalActionCommand.test.ts = 99`，`onlineAiLegalActionRecoveryExecutor.test.ts = 159`，`onlineAiRepeatedRecoveryUnblockExecutor.test.ts = 204`，`onlineAiWatchdogSequenceFingerprinting.test.ts = 53`，`onlineAiWatchdogFeedbackDiagnostics.test.ts = 112`。这只是分层进度，不代表 `server.ts` 已完成全部重构。
- 行为合同：未改变 watchdog fallback 顺序、AI 决策来源、命令执行回滚和服务端锁管理。

## 9. 验证证据

- 命令：`npx eslint src/engine/transport/server.ts src/engine/transport/commandFailureReason.ts src/engine/transport/onlineAiLegalActionCommand.ts src/engine/transport/onlineAiLegalActionRecoveryExecutor.ts src/engine/transport/onlineAiRepeatedRecoveryUnblockExecutor.ts src/engine/transport/onlineAiWatchdogSequenceHelpers.ts src/engine/transport/onlineAiWatchdogSequenceFingerprinting.ts src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts src/engine/transport/__tests__/commandFailureReason.test.ts src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts src/engine/transport/__tests__/onlineAiRepeatedRecoveryUnblockExecutor.test.ts src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiWatchdogFeedbackDiagnostics.test.ts`
  - 结果：通过。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/commandFailureReason.test.ts src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts --configLoader native`
  - 结果：2 files passed；10 passed。
  - 关键结果：命令失败原因格式化、自动上报判定、legal-action 系统命令跳过预检、普通命令权威预检、validate 抛错 deferred 合同均通过。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts --configLoader native`
  - 结果：1 file passed；2 passed。
  - 关键结果：第一条命令后归属变化时停止后续命令并按已恢复返回；权威预检拒绝时不进入执行管线并返回命令失败合同。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecoveryDispatch.test.ts --configLoader native`
  - 结果：1 file passed；4 passed。
  - 关键结果：human/manual guard 不进 dispatch；emergency 第二次拿 raw playerView；response-loop 经 emergency 后仍 stale 不触发 overlay resync；非 response-loop blocked 保留 overlay resync 建议。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogFeedbackDiagnostics.test.ts src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiRepeatedRecoveryUnblockExecutor.test.ts src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts src/engine/transport/__tests__/commandFailureReason.test.ts src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts src/engine/transport/__tests__/onlineAiRecoveryDispatch.test.ts src/engine/transport/__tests__/onlineAiRecoveryOwnership.test.ts src/engine/transport/__tests__/onlineAiExecutor.test.ts --configLoader native`
  - 结果：9 files passed；28 passed。
  - 关键结果：feedback diagnostics、dispatch、ownership、executor、命令失败原因、legal-action 权威预检、legal-action recovery 执行器、repeated recovery 强制解卡执行器、recovery fingerprint 九个拆分模块的直接合同均通过。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "buildOnlineAiRecoveryFingerprint|blockerFingerprint|在线 AI watchdog 选出的动作若被权威领域状态拒绝|同一卡点重复恢复三次|同一合法动作连续命令失败达到上限" --configLoader native`
  - 结果：1 file passed；15 passed，266 skipped。
  - 关键结果：server 兼容入口委托到 fingerprint / diagnostics 模块后，fingerprint 与 blocker fingerprint 漂移断言仍通过；权威预检失败不进 execute；repeated recovery 上限后能强制解卡，存在 response window 时不裸 `ADVANCE_PHASE`；同一合法动作连续失败达到上限后不无限重试。
- 命令：`npx cross-env PW_E2E_SERVICE_REUSE=isolated npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`
  - 结果：2 passed。
  - 关键结果：空回合 match `Eyn0DuRnSw0`，`returnedElapsedMs=2434`；连续召唤 match `UpA4UAe3ZXb`，`firstToSecondSummonEventGapMs=1020`，`firstToSecondSummonGapMs=1065`（页面轮询采样值，不作为 1 秒节奏断言权威）；运行权归属为 `server-online-ai-executor`。
- 命令：`npm run test:ai:decision-view`
  - 结果：未作为通过项；脚本当前失败。当前统计为 4 个测试文件中 3 个通过、1 个失败；477 个用例中 476 个通过、1 个失败。
  - 当前失败：1 个测试失败，`src/pages/__tests__/matchSeatValidation.test.ts > resolveNextAiAction 在线视角 > DiceThrone 右侧奖励骰普通确认应允许在线 AI 基于共享状态收口`。
  - 失败原因：DiceThrone 奖励骰测试夹具缺掷骰者角色，错误为 `奖励骰缺少掷骰者角色：playerId=1`。这是 DiceThrone 测试夹具问题，不回代为 Summoner Wars 本轮真实 E2E 失败。

## 10. 证据边界

- 本 evidence 证明服务端在线 AI 的共享可见动作节奏链已修正，并用 Summoner Wars 真实在线入口验证。
- 本 evidence 不证明所有游戏完整 AI 策略已全面审计通过，也不证明所有体感慢的潜在原因都已根治。

## 11. 对外汇报口径

- 允许说：不是没用白名单；白名单已生效。问题是服务端此前把同一自动片段第一次可见动作的等待拿来抵扣第二次可见动作。
- 允许说：Summoner Wars 连续可见召唤现在按上一次可见动作完成时间重新等待，真实 E2E 已通过。
- 禁止说：所有游戏 AI 策略已全面通过。
- 禁止说：所有“等很久”的可能原因都已经根治。
