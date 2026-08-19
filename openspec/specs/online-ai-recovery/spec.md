# online-ai-recovery Specification

## Purpose
TBD - created by archiving change add-online-ai-watchdog-fallback. Update Purpose after archive.
## Requirements
### Requirement: 在线 AI 卡死必须有服务端权威兜底
系统 SHALL 在 `GameTransportServer` 内部为在线房间的 AI 座位维护权威 recovery watchdog，而不是只依赖房主页面上的前端桥接层。

#### Scenario: 房主页面未能提交 AI 恢复命令时，服务端仍可接管
- **GIVEN** 某个在线房间存在 AI seat
- **AND** 当前阻塞状态属于该 AI seat 的隐藏交互、可见交互、响应窗口或活动回合
- **WHEN** 进度 marker 在阈值窗口内持续不变
- **THEN** 服务端 MUST 在权威状态上生成并执行恢复动作
- **AND** 不得要求房主页面存活、联网或持有可用 AI seat 凭据才可恢复

#### Scenario: 当前轮到真人时，服务端不得误判为 AI 卡死
- **GIVEN** 当前活动回合属于 human seat，或当前 response window responder 属于 human seat
- **WHEN** recovery watchdog 扫描房间状态
- **THEN** 服务端 MUST 不生成任何 AI 强制恢复动作

### Requirement: 在线 AI 强制恢复必须采用两段式权威确认
系统 SHALL 先解开 AI 当前阻塞，再基于最新权威状态多步推进阶段直到安全收口。

#### Scenario: 交互或响应窗口卡住时先解阻塞
- **GIVEN** 某个 AI seat 正卡在交互或响应窗口
- **WHEN** 服务端 watchdog 触发恢复
- **THEN** 第一段恢复 MUST 只提交 `RESPOND / CANCEL / PASS` 之类的最小恢复命令
- **AND** 不得在同一段恢复里直接假定后续阶段必然可推进

#### Scenario: 解阻塞后仍是该 AI 的回合才允许 follow-up ADVANCE_PHASE
- **GIVEN** 第一段恢复已执行成功
- **WHEN** 服务端读取最新权威状态
- **THEN** 只有在“仍是该 AI 的回合 + 没有新交互 + 没有新 response window”时，系统才可以继续生成 `ADVANCE_PHASE`
- **AND** 系统 MUST 在每次推进后重新读取权威状态，直到切回 human、出现新阻塞或命中安全步数上限
- **AND** 若最新权威状态已切回 human 或出现新阻塞，系统 MUST 立即终止后续 follow-up

### Requirement: 无解交互不得继续把 AI 困在阻塞态
系统 SHALL 在交互层与 AI 决策层共同兜底“当前 interaction 无任何可解路径”的场景，而不是只能等 watchdog 超时救火。

#### Scenario: simple-choice 选项为空、全 disabled 或最少选择数不可达时，系统应立即变为可解
- **GIVEN** 当前 `simple-choice` interaction 在创建后或动态刷新后出现以下任一情况：
  - 选项为空
  - 所有选项都为 disabled
  - `multi.min` 大于当前 enabled 选项数
- **WHEN** 系统准备把该 interaction 交给玩家或 AI 消费
- **THEN** 系统 MUST 注入或保留一条可执行的恢复路径（如 `__emergency_skip__`、空选择或显式 skip/cancel）
- **AND** 不得继续保留“阻塞了 `ADVANCE_PHASE` 但又没有任何可执行动作”的死锁态

#### Scenario: AI 缺少游戏专属交互动作时，仍应能走通用恢复动作
- **GIVEN** 某个游戏自己的 AI `buildLegalActions` 没有为当前无解 interaction 生成动作
- **WHEN** 引擎构建 AI 决策上下文
- **THEN** 引擎 SHOULD 自动补一个通用 interaction fallback action
- **AND** 该 fallback 至少应覆盖空选择或 `__emergency_skip__` 这类确定性恢复路径

### Requirement: 强制恢复 incident 必须自动反馈且可去重
系统 SHALL 对在线 AI recovery incident 执行 best-effort 自动反馈，并对同一 incident 做去重与冷却。

#### Scenario: 强制结束或恢复失败达到阈值时自动写入反馈
- **GIVEN** 服务端 watchdog 成功执行了 `force-end-turn`，或同一 incident 连续恢复失败达到阈值
- **WHEN** 系统准备记录该 incident
- **THEN** 系统 MUST 向现有 `/feedback` 管道提交一条结构化 bug 反馈
- **AND** 反馈 MUST 包含至少 `gameId`、`matchId`、`playerId`、incident kind、reason 与精简 `stateSnapshot`

#### Scenario: 交互类 incident 的反馈应尽量说明“为什么无法选择”
- **GIVEN** 某条 AI recovery incident 与 interaction choice 有关
- **WHEN** 系统生成自动反馈
- **THEN** `stateSnapshot` SHOULD 包含共享视角或 seat 视角下的 interaction options 摘要
- **AND** 若存在 disabled 选项，反馈 SHOULD 记录其 disabled 状态与可用的禁用原因字段
- **AND** 系统 SHOULD 额外给出可选性诊断（如 `no-options`、`all-options-disabled`、`manual-selection-required`、`recoverable-option-available`）

#### Scenario: AI 触发 emergency skip 时应立即自动反馈
- **GIVEN** AI seat 没有等待 watchdog，而是在当前 interaction 中直接走了 `__emergency_skip__`
- **WHEN** 服务端收到该交互取消事件
- **THEN** 系统 SHOULD 立即提交一条自动反馈，而不是等 8 秒后的 watchdog incident
- **AND** 反馈中 SHOULD 包含触发前的 interaction 快照与可选性诊断，供后续把该交互修回“有解”

#### Scenario: 同一 incident 在冷却窗口内不得重复刷反馈
- **GIVEN** 某条 AI recovery incident 已在当前去重键下成功或失败上报过一次
- **WHEN** 冷却窗口内再次命中同一 incident key
- **THEN** 系统 MUST 跳过重复反馈提交
- **AND** 仍可记录本地日志计数，但不得持续向反馈后台刷同一问题

### Requirement: 前端桥接层必须在服务端接管后降噪
系统 SHALL 将房主页面上的 `OnlineAiSeatBridge` 视为次级 fallback；一旦服务端已接管同一 incident，前端不得持续以失败 toast 轰炸用户。

#### Scenario: 服务端已接管同一 incident 时，前端不再重复提示失败
- **GIVEN** 前端桥接层识别到服务端已经推进了同一 AI recovery incident
- **WHEN** 原本的客户端 fallback batch 返回 stale failure 或状态已被权威推进
- **THEN** 前端 MUST 先同步最新权威状态
- **AND** 不得继续重复显示“强制结束 AI 回合未成功，会继续重试”的噪音提示

#### Scenario: 前端仍需展示精确失败原因
- **GIVEN** recovery incident 确实在当前阶段失败
- **WHEN** 前端向用户展示提示
- **THEN** 提示 MUST 能区分至少“阶段（recover-interaction / follow-up-advance）”与“reason（unauthorized / disconnected / command_failed / not_connected）”
- **AND** 不得把所有失败都压成同一句模糊文案

### Requirement: Online AI Recovery SHALL Consume Choice Request Diagnostics

Online AI recovery SHALL use Choice Request diagnostics to understand why an AI-controlled seat is blocked, rather than inferring business targets or relying only on generic timeout recovery.

#### Scenario: AI lacks policy for current request
- **GIVEN** an online AI seat is blocked by a Choice Request
- **AND** legal action generation reports a missing AI policy
- **WHEN** recovery records the incident
- **THEN** the incident MUST identify the choice kind, request source, actor, candidate count, and missing policy category
- **AND** watchdog MUST NOT invent a target or choose the first business candidate as a substitute strategy

#### Scenario: Choice Request has invalid candidate bounds
- **GIVEN** an online AI seat is blocked by a mandatory Choice Request whose enabled candidates cannot satisfy the minimum selection count
- **WHEN** recovery evaluates the blocked seat
- **THEN** the incident MUST classify the failure as an invalid or unsatisfied request
- **AND** recovery MAY only use an explicit request-declared skip, pass, cancel, or confirm-current path if one exists

### Requirement: Watchdog SHALL Remain Recovery, Not Business Decision Logic

Online AI watchdog SHALL recover from stalls by re-entering the authoritative AI execution path or executing an explicit Choice Request recovery action; it MUST NOT become a parallel business selection engine.

#### Scenario: Choice Request declares explicit skip
- **GIVEN** a stalled AI-owned request declares an explicit skip or pass action
- **WHEN** watchdog recovery is allowed to act
- **THEN** watchdog MAY request execution of that declared recovery action through the authoritative AI/server path
- **AND** the action MUST be recorded as a recovery outcome with the Choice Request snapshot

#### Scenario: Choice Request requires strategic target choice
- **GIVEN** a stalled AI-owned request requires choosing among strategic targets
- **AND** no AI policy can score those targets
- **WHEN** watchdog recovery runs
- **THEN** watchdog MUST report the missing strategy as the blocking reason
- **AND** it MUST NOT choose a target solely because it is first, closest, visible, or easy to serialize

