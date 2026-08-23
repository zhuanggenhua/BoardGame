---
name: timing-opportunity-resolution
description: 时点-机会-结算标准：TimingPoint、Opportunity、Choice Request 和 Resolution Stack——接入复杂触发、响应、替代、防止或长事务规则时查
metadata:
  type: doc
  status: 实施中
---

# 时点-机会-结算规则内核标准

本文定义复杂桌游规则的 opt-in 主轴：`TimingPoint -> Opportunity -> ChoiceRequest / ResponseWindow -> ResolutionFrame -> EventCommit`。

它不是每个游戏默认要接入的框架。只有需求涉及触发、响应、替代、防止、长事务、隐藏选择、AI 阻塞、跨事件结算或线上恢复卡点时，才按本文建模。旧游戏未触碰相关窗口时可继续兼容；触碰时先判断是否迁移，避免继续新增私有 `pending* / continuationContext / reactionStack`。

YGOPro 的可吸收点是裁判式架构，不吸收其 GPL 脚本、原生 UI、素材或单游戏规则常量。吸收分层和当前差距见 [`ygopro-timing-opportunity-absorption-2026-08-21.md`](../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md)。

## 接入触发

命中以下任一类机制时，从机制建模阶段建立最小 Timing / Opportunity 矩阵：

- 阶段开始 / 结束、核心动作、攻击、伤害、移动、计分、支付、抽牌、弃牌、清场、胜负检查需要可插入时点。
- 存在可选、强制、响应、替代、防止、持续或延迟效果。
- 需要让玩家、AI 或恢复链路处理阻塞选择。
- 事件正式写入前可能被取消、改写、缩小、重定向或替代。
- 多步结算需要父子恢复、清场后续、跨阶段收口或 deferred follow-up。

没有这些需求时，不为“统一”而引入响应窗口、结算栈或复杂机制状态。

## 常驻底座与按需机制

平台应常驻的是规则底座，不是每局都打开复杂机制。

| 层级 | 常驻 / 按需 | 现实职责 |
| --- | --- | --- |
| 命令、事件、正式归约、校验 | 常驻 | 规则真相源唯一；UI、AI、日志和测试只消费投影 |
| 静态配置、素材、文案、运行态分层 | 常驻 | 不让 UI 文案或素材路径成为规则事实 |
| Choice Request 合同 | 常驻能力，按需创建实例 | 所有阻塞选择同源供 UI、服务端验证、AI 和恢复消费 |
| 玩家视图 / AI 视图 / 裁判视图 | 常驻能力 | 从同一状态投影，不泄漏私有候选 |
| TimingPoint / Opportunity | 按需 | 触发、响应、替代、防止、持续、延迟或跨事件结算 |
| ResponseWindow | 按需 | 响应者队列、让过、窗口关闭和命令门控 |
| ResolutionFrame | 按需 | 长事务、父子恢复、deferred follow-up 和当前阻塞 owner |
| EventCommit | 按需 | 正式归约前的 replacement / prevention |

## 职责归位

| 概念 | 做什么 | 不做什么 |
| --- | --- | --- |
| `TimingPoint` | 描述规则事实发生前、中、后或阶段边界的断点 | 不承载玩家选择，不保存 UI 状态 |
| `Opportunity` | 描述某来源在某时点获得的强制、可选、响应、替代、防止、持续或延迟机会 | 不直接变按钮列表，不绕过验证执行事件 |
| `ChoiceRequest` | 描述玩家或 AI 的结构化选择、候选、跳过、命令和 AI 支持 | 不发现机会，不拥有长事务 |
| `ResponseWindowSystem` | 承载响应者队列、让过、窗口关闭和命令门控 | 不作为“谁能响应”的规则真相源 |
| `InteractionSystem` | 承载当前交互和队列，向 UI / AI 暴露输入面 | 不决定整条结算链是否完成 |
| `ResolutionFrame` | 持有长事务、恢复点、deferred follow-up 和阻塞 owner | 不发现所有机会，不替代领域事件正式归约 |
| `DomainCore / pipeline` | 验证命令、执行基础事件、正式归约事件、触发后处理 | 不把 UI 焦点、按钮显示或 AI fallback 当规则授权 |
| `playerView / transport / AI` | 过滤可见状态、传输决策面、消费合法动作 | 不自行猜隐藏机会或私有候选 |

## 当前代码入口

| 入口 | 职责 | 边界 |
| --- | --- | --- |
| [`TimingOpportunity.ts`](../../../src/engine/TimingOpportunity.ts) | `TimingPoint`、`Opportunity`、发现 runner、诊断和投影 helper | 不执行效果，不写状态 |
| [`primitives/ability.ts`](../../../src/engine/primitives/ability.ts) | 将 `AbilityDef` 生命周期投影为 Opportunity / ChoiceRequest 合同 | 只产出来源、控制者、条件、费用、目标、结算入口、可见性和 AI 元数据 |
| `DomainCore.discoverTimingOpportunities` | 游戏 opt-in 机会发现入口 | 未实现时返回空机会，不改变旧行为 |
| `DomainCore.commitEvent` | 正式归约前的 opt-in 事件提交入口 | 旧 `interceptEvent` 只作兼容层 |
| `commitEventWithTimingOpportunities` | 最小 EventCommit driver，处理简单 replacement / prevention | 只直接提交单个 `events` resolution；多事件、阻塞选择、response window、child frame、commands 默认报错，需游戏显式合成 |
| `EventCommitEvidence` / `PipelineResult.eventCommitEvidence` | 记录提交前机会发现和应用证据 | 证据是审计 / 回放查询面，不是第二套规则状态 |
| `createRefereeTraceSystem` | 将 EventCommit 证据写入 `G.sys.refereeTrace` | 不生成玩家日志、不驱动动画、不授权规则 |
| [`RefereeView.ts`](../../../src/engine/RefereeView.ts) | 只读裁判消息和决策快照 | 不发现机会、不创建交互、不推进窗口、不授权 UI / AI / 服务端 |
| [`RefereeReplay.ts`](../../../src/engine/RefereeReplay.ts) | 从结果或 trace 汇总回放摘要和恢复指纹片段 | 不重新 reduce，不执行响应，不生成第二套事件源 |
| `createResolutionFrameSystem` | 可选长事务 driver，回灌 active frame 的 `deferredEvents` | 不进 `createBaseSystems`；`deferredActions` 没有通用宿主时不静默消费 |
| `createTimingOpportunitySystem` | 可选系统，把 active opportunity 投影成交互、response window、child frame 或后续事件 | 不进 `createBaseSystems`；命中需求才显式加入 |
| `createSimpleChoiceFromTimingOpportunity` | `Opportunity -> ChoiceRequest -> simple-choice` 交互宿主薄投影 | 只投影交互承载格式，不发现机会、不生成候选、不保留旧规则 fallback；无兼容迁移仍必须删除旧规则 owner |

`commands` resolution 当前没有通用执行宿主；系统必须明确报错，要求改成 `ChoiceRequest` 或由游戏层正式 owner 处理。

## 核心模型

### TimingPoint

`TimingPoint` 至少表达：

- 来源事实：命令、事件、阶段变化、对象移动、伤害、计分、攻击、支付、抽牌、弃牌、清场、胜负检查。
- 位置：`before`、`replace`、`prevent`、`after`、`postCommit`、`phaseStart`、`phaseEnd` 或游戏声明的等价断点。
- 上下文：来源对象、控制者、影响对象、目标、事件批 ID、父 frame、可见性边界。
- 时效：本事件前、本事件后、本轮、持续检查或延迟触发。

### Opportunity

`Opportunity` 至少回答：

| 字段 | 问题 |
| --- | --- |
| `id` | 稳定身份是什么 |
| `timing` | 来自哪个 `TimingPoint` |
| `sourceRef` | 来源是卡牌、技能、Token、状态、规则还是场景 |
| `controllerId` | 谁拥有或决定机会 |
| `class` | 强制、可选、响应、替代、防止、持续还是延迟 |
| `condition` | 当前事实下是否成立 |
| `cost` | 成本是什么，何时支付，失败是否回滚 |
| `targetRequest` | 是否需要目标、数量、顺序或模式 |
| `resolution` | 最终执行事件、命令、ChoiceRequest、response window 或子 frame |
| `ordering` | 同时机会如何排序 |
| `visibility` | 哪些玩家、AI 或旁观者可见 |
| `aiSupport` | 共享策略、游戏策略或明确不支持 |

### Choice 和 Response

- 目标、模式、数量、顺序、是否执行、让过、确认都必须结构化表达。
- AI 消费同一份 choice / opportunity 合同；不得从 UI 文案、数组下标或按钮顺序猜。
- response window 只承载当前响应者、让过和关闭条件；可响应机会来自 Opportunity 发现结果。
- 响应关闭必须匹配 live ChoiceRequest、候选来源和对应 ResolutionFrame；匹配失败应暴露为内部合同错误，不误关其它交互或私有窗口。

### Resolution

- 跨事件批、交互、响应窗口、阶段推进、清场或 deferred follow-up 的链路由 `ResolutionFrame` 承载。
- 父 frame 被子 frame 打断时，父 frame 保留恢复位点；子 frame 完成后恢复父 frame。
- deferred events / actions 由 frame 单一持有；共享 driver 只自动回灌 `deferredEvents`。
- frame handler 返回推进结果：继续发事件、等待选择、打开响应窗口、push 子 frame、等待 post-reduce 或完成。

### EventCommit

- 替代 / 防止发生在事件正式写入前；事实触发只能在事件正式改变状态后产生。
- 简单 replacement / prevention 可由 `commitEventWithTimingOpportunities` 处理；多个改写机会或领域专属顺序必须通过 `composeEventCommitPlan` 显式提交。
- 需要选择输入的机会必须在事件提交前已有正式阻塞入口；不得在 EventCommit 阶段临时新开选择。
- 提交证据至少能追到原事件类型、命令类型、`eventCommit` 时点、机会时点、发现机会 ID 和应用机会 ID。

## 接入验收

接入后的最低验收：

- 每个 opportunity 能追到 UI、服务端验证、执行 / reducer、AI legal-action 和日志 / 事件。
- 同一机会只有一个规则真相源；UI、AI、validator 不各写一套条件。
- response window 只是承载层，不是机会发现器。
- 长事务有 frame owner；不能只靠 `continuationContext`、`pending*` 或按钮状态续链。
- 无线上存档、无旧客户端、同仓同轮可切完，或用户明确要求激进重构 / 不考虑兼容时，验收必须证明旧 owner 已退出：同一机制不能同时保留旧直接结算入口和新的 `TimingOpportunity / ChoiceRequest / ResolutionFrame` owner。
- 对旧 owner 的退出证明要用负向断言或等价证据覆盖：原始执行器、旧系统、UI 旧 fallback、AI 旧合法动作和测试夹具不能再直接生成同一正式结果；正式结果只能从新 owner 结算出来。
- 首个试点至少覆盖一种高风险链路：计分、响应、替代、防止或延迟 follow-up；第二个验证场景选择不同机制家族，避免单一游戏外推。

## 旧游戏兼容和迁移

- 未触碰的旧 `simple-choice`、`pending*`、`continuationContext`、私有 session 可继续兼容。
- 触碰触发、响应、替代、防止、长事务、AI 阻塞或线上恢复卡点时，先判断是否接入本文模型。
- 未上线、无旧客户端、无线上存档兼容负担的游戏，命中本文需求时必须直接把机会发现、开窗、阻塞选择和后续结算 owner 切到 `TimingOpportunitySystem` / `ChoiceRequest` / `ResolutionFrame`，并在同轮删除或停用旧 owner；不得为了“保险”保留兼容桥。
- 用户当轮明确要求激进重构、不考虑兼容、直接完成时，按无兼容迁移处理；只有能指出真实外部消费者、混部版本、旧客户端仍在线或持久化迁移风险时，才允许临时 adapter。
- 旧游戏专用系统若暂留，只能处理响应后的领域结算，不能继续独立发现同一机会或创建同一窗口。
- 允许临时 adapter 时，它只能把旧入口映射到新的 opportunity / frame，不能继续成为第二套规则权威；同时必须写清真实依据、剩余消费者、删除条件和删除验证。
- 迁移文档必须写清旧入口、新 owner、已切走消费者、是否存在临时 adapter、旧 owner 退出证据、剩余删除条件和验证证据；没有兼容负担的迁移不写“兼容 fallback”作为默认任务。

## 禁止项

- 有触发 / 响应 / 替代 / 防止 / 长事务需求的新链路，不把主响应链写成私有 `pending* / continuationContext / reactionStack / actionCounterStack`。
- 禁止 UI 按钮列表、卡牌高亮、弹窗 kind 或选项文案成为机会真相源。
- 禁止 AI 用按钮文案、数组下标、翻译文本或 fallback 猜合法动作。
- 禁止 ResponseWindow 自己代表“所有可响应事实”；它只能承载已发现机会。
- 禁止 `ResolutionFrame` 只做门控标记，而长事务恢复点继续由游戏私有 session 持有。
- 禁止为兼容旧入口新增第二套影子状态、去重表或静默兜底；内部不变量破坏时应暴露错误来源。
- 禁止把“新 owner 可用”当成“重构完成”；旧 owner、旧 fallback 或旧测试入口仍能独立结算同一机制时，重构未完成。

## 关联标准

- 引擎总览：[`engine-systems.md`](engine-systems.md)。
- 玩家选择、权限矩阵、UI / AI 同源：[`rule-driven-interaction-design.md`](rule-driven-interaction-design.md)。
- 响应和在线 AI 私有视图：[`engine-transport.md`](engine-transport.md)。
- YGOPro 对照和吸收分析：[`ygopro-timing-opportunity-absorption-2026-08-21.md`](../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md)。
