# 在线 AI 可见动作节奏修复证据（2026-08-19）

## 1. 基本信息

- 对象：服务端在线 AI 自动执行链的可见动作等待。
- 日期：2026-08-19。
- 作者：Codex。
- 文档类型：closeout。
- 关联症状：用户反馈在线 AI “别说一秒，直接卡死 / 等了很久 / 没用白名单吗”，并澄清 DiceThrone 只是刚刚触发点，Summoner Wars 当前影响最大。

## 2. 审计范围

- 本轮覆盖模块：`src/engine/transport/server.ts`、`src/engine/transport/onlineAiActionDelay.ts`、`src/engine/transport/onlineAiExecutor.ts`、`src/engine/transport/onlineAiSeatControllers.ts`、`src/engine/transport/__tests__/onlineAiExecutor.test.ts`、`src/engine/transport/__tests__/server.test.ts`、`e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`。
- 本轮覆盖链路：服务端在线 AI 即时执行入口和 watchdog legal-action 恢复入口。
- 本轮真实入口 / 环境：Summoner Wars 在线房间，`seatControllers['1'] = local-ai`，`minimumActionDelayMs = 1000`，服务端权威执行 AI。
- 明确不覆盖：所有游戏完整 AI 策略质量、所有游戏逐个真实 E2E、视觉动效产品级调优。

## 3. 结论等级

- 结论：功能实现已验证。
- 判定理由：服务端在线 AI 已按游戏 runtime 白名单判断可见 / 静默动作；连续可见动作改为按“上一次可见动作成功完成时间”重新计时。Summoner Wars 真实在线 E2E 通过，连续两次可见召唤的服务端事件间隔为 1011ms。

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
| Summoner Wars 真实入口 | 连续两次可见召唤之间应保留约 1 秒节奏 | Summoner Wars 在线 E2E | match `Oj0l5m1JHKU`：召唤事件间隔 `1011ms`；页面轮询采样间隔 `1058ms`，不作为节奏断言权威 | `e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts` | 通过 |

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
- 当前行数：`server.ts = 7145`，`onlineAiSeatControllers.ts = 145`，`onlineAiExecutor.ts = 285`，`onlineAiActionDelay.ts = 109`。这只是分层进度，不代表 `server.ts` 已完成全部重构。
- 行为合同：未改变 watchdog fallback 顺序、AI 决策来源、命令执行回滚和服务端锁管理。

## 9. 验证证据

- 命令：`npx eslint src/engine/transport/server.ts src/engine/transport/onlineAiExecutor.ts src/engine/transport/onlineAiSeatControllers.ts src/engine/transport/onlineAiActionDelay.ts src/engine/transport/__tests__/onlineAiExecutor.test.ts`
  - 结果：通过。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiExecutor.test.ts --configLoader native`
  - 结果：1 file passed；1 passed。
  - 关键结果：AI 命令序列第二条失败时，第一条命令副作用回滚，失败原因保留。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "Summoner Wars 即时服务端 AI 可见动作应等待|Summoner Wars 即时服务端 AI 同一自动片段里的连续可见动作|runtime 白名单存在时|resolveLocalAiActionDelayPlan" --configLoader native`
  - 结果：1 file passed；9 passed，272 skipped。
  - 关键结果：单次可见动作 999ms 时未提交、1000ms 后提交；连续两次 Summoner Wars `summon-unit` 均等待 1000ms。
- 命令：`npx cross-env PW_E2E_SERVICE_REUSE=isolated npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`
  - 结果：2 passed。
  - 关键结果：空回合 `returnedElapsedMs=2215`；连续召唤 `firstToSecondSummonEventGapMs=1011`；运行权归属为 `server-online-ai-executor`。

## 10. 证据边界

- 本 evidence 证明服务端在线 AI 的共享可见动作节奏链已修正，并用 Summoner Wars 真实在线入口验证。
- 本 evidence 不证明所有游戏完整 AI 策略已全面审计通过，也不证明所有体感慢的潜在原因都已根治。

## 11. 对外汇报口径

- 允许说：不是没用白名单；白名单已生效。问题是服务端此前把同一自动片段第一次可见动作的等待拿来抵扣第二次可见动作。
- 允许说：Summoner Wars 连续可见召唤现在按上一次可见动作完成时间重新等待，真实 E2E 已通过。
- 禁止说：所有游戏 AI 策略已全面通过。
- 禁止说：所有“等很久”的可能原因都已经根治。
