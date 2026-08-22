---
name: timing-opportunity-resolution
description: 时点-机会-结算标准：TimingPoint、Opportunity、Choice Request 和 Resolution Stack——接入复杂触发、响应、替代、防止或长事务规则时查
metadata:
  type: doc
  status: 实施中
---

# 时点-机会-结算规则内核标准

## 目标

BoardGame 要支持约 100 个桌游。TCG 暴露出来的“时点响应模型”不是某一类游戏的边角能力，而是复杂桌游的基础规则原语。本文不是要求每个新游戏都接入这套框架；只有当需求涉及触发、响应、替代、防止、长事务、隐藏选择、AI 阻塞或跨事件结算时，才接入 `TimingPoint -> Opportunity -> ChoiceRequest / ResponseWindow -> ResolutionFrame -> EventCommit` 主模型。

旧游戏可保留兼容，不要求一次性重构；但触碰相关窗口时，先按本文判断是否迁移，避免继续新增私有主链。

## 参考裁决

`ygopro` 的可吸收点是裁判式架构：规则核心推进到可响应时点，外部 UI / 客户端提交 response 后继续；卡牌效果以条件、费用、目标、执行函数注册；静态资料、牌组、脚本和 UI 分离。本文只定义其中“时点-机会-结算”主轴；完整 TCG 裁判框架还包括效果生命周期、事件改写、裁判消息协议、静态资料分层、可查询视图、确定性回放和配置导入导出，吸收分层见 [`../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md`](../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md)。项目不吸收其代码、GPL 脚本、原生 UI、素材或单游戏规则常量。

本项目目标高于单一 TCG：时点模型应能服务 TCG、战斗游戏、地城探索、区域控制、骰子格斗、战争棋和其它复杂桌游，但只在对应游戏确有这类规则需求时启用。

## 常驻底座和按需机制

“通用基础能力”和“每局都打开复杂机制”必须分开。平台层应常驻的是裁判底座：所有游戏都能接入同一套规则真相、验证、选择、视图和证据链；按需启用的是响应窗口、替代 / 防止、结算栈、复杂效果生命周期等机制状态。

所有游戏都应遵守或复用的常驻底座：

- 命令、事件、正式归约和校验链路有唯一规则真相源。
- 静态配置、素材、文案、运行时状态和规则执行分层，不让 UI 或文案成为规则事实。
- 任何玩家或 AI 的阻塞选择都用结构化选择合同表达，并能被 UI、服务端验证、AI 和恢复链路同源消费。
- 玩家视图、AI 视图、日志、审计和测试回放从同一份规则状态投影，不各自猜合法动作。
- 能力、卡牌、Token、状态或场景效果存在时，定义应能表达来源、控制者、条件、费用、目标、执行、次数限制、可见性和 AI 支持。
- 复杂规则上线前能留下可复现证据：命令、响应、随机游标、事件提交和最终状态可回放或可测试。

按需启用的机制状态：

- `TimingPoint / Opportunity` 矩阵：触发、响应、替代、防止、持续、延迟或跨事件结算存在时启用。
- response window：确有“谁可以在此时响应、是否让过、何时关闭”的规则窗口时启用。
- `ResolutionFrame` 长事务：存在父子恢复、多步结算、清场后续、跨阶段收口或 deferred follow-up 时启用。
- replacement / prevention 流：原事件落地前可能被取消、改写、缩小、重定向或替代时启用。
- 脚本沙箱、牌组格式、配置导入导出：有 UGC、可扩展卡组、剧本包、地图包或内容分享时启用。

加平台底座通常只有好处；把复杂机制状态无条件塞进每个游戏则有现实坏处：会产生假的响应窗口和跳过按钮、扩大 AI 合法动作面、增加恢复和联机状态、拉大测试矩阵、让简单游戏背上 TCG 专属顺序假设。正确做法是共享类型、验证、视图和证据链常驻，机制 driver 在命中需求时接管，不命中时保持零入口或空发现结果。

## 职责归位

| 概念 | 现实职责 | 不允许抢的职责 |
| --- | --- | --- |
| `TimingPoint` | 描述规则事实发生前、发生中、发生后或阶段边界的断点 | 不承载玩家选择、不保存 UI 状态 |
| `Opportunity` | 描述某个时点上一个来源获得的强制、可选、响应、替代、防止或持续机会 | 不直接变成按钮列表、不绕过验证执行事件 |
| `ChoiceRequest` | 描述玩家或 AI 需要做的结构化选择，含候选、跳过、命令和 AI 支持 | 不负责发现机会、不拥有长事务 |
| `ResponseWindowSystem` | 承载响应者队列、让过、窗口关闭和命令门控 | 不作为“谁能响应”的唯一规则真相源 |
| `InteractionSystem` | 承载当前交互和队列，向 UI / AI 暴露输入面 | 不决定整条结算链是否完成 |
| `ResolutionFrame` | 持有长事务、父子恢复点、deferred follow-up 和当前阻塞 owner | 不发现所有机会、不替代领域事件正式归约 |
| `DomainCore / pipeline` | 验证命令、执行基础事件、正式归约事件、触发后处理 | 不把 UI 焦点、按钮显示或 AI fallback 当作规则授权 |
| `playerView / transport / AI` | 过滤可见状态、传输决策面、消费合法动作 | 不自行猜测隐藏机会或私有候选 |

## 核心模型

## 当前代码落点

引擎层已提供第一批可选接入点：

- `src/engine/TimingOpportunity.ts` 定义 `TimingPoint`、`Opportunity`、发现 runner、校验诊断，以及投影到 `ChoiceRequest`、response window 和 `ResolutionFrame` 的 helper。`src/engine/primitives/ability.ts` 提供 `AbilityLifecyclePhase`、`AbilityLifecycleRef`、`buildOpportunityFromAbilityDef` / `createAbilityOpportunity`，用于把能力定义在具体规则时点投影成 Opportunity 合同；`createAbilityChoiceContract` 用于把能力输入面投影成带 request / candidate provenance 的 `ChoiceRequest` 子合同。该投影只产出来源、控制者、条件、费用、目标、结算入口、可见性和 AI 元数据，不执行效果、不支付费用、不写状态。
- `DomainCore.discoverTimingOpportunities` 是游戏层 opt-in 发现入口。旧游戏不实现该入口时，runner 返回空机会和空诊断，不改变旧行为。
- `DomainCore.commitEvent` 是事件正式归约前的 opt-in 提交入口。它接收完整 `MatchState`、当前命令和 `eventCommit` 时点，可取消、改写或拆分事件；旧 `interceptEvent` 保留为兼容层，在 `commitEvent` 之后执行。
- `commitEventWithTimingOpportunities` 是最小共享 EventCommit driver：在正式归约前用 `replace` / `prevent` 时点发现 replacement / prevention 机会，统一校验和排序；`none` resolution 只作为证据，单个 `events` resolution 可直接替代当前事件批。多个 `events` resolution 或任何会阻塞提交的 `choice-request`、`response-window`、`child-frame`、`commands` resolution 默认直接报错；游戏可通过 `composeEventCommitPlan` 显式合成提交计划，避免通用层静默猜顺序。
- `EventCommitEvidence` / `PipelineResult.eventCommitEvidence` 已作为事件提交证据出口：当 replacement / prevention 机会被发现或应用时，管线结果能查询原事件、命令类型、`eventCommit` 时点、机会时点、发现机会和实际应用机会。没有机会的普通事件不产生证据噪音；自定义 `DomainCore.commitEvent` 如需保留证据，必须通过 `{ events, evidence }` 返回。
- `createRefereeTraceSystem` 是基础系统集合中的常驻审计出口，会把当前事件轮次的 `EventCommitEvidence` 写入 `G.sys.refereeTrace`，供回放、测试、线上诊断和裁判视图查询。它不生成玩家日志、不驱动动画、不参与规则授权；无提交证据时不写入条目。
- `src/engine/RefereeView.ts` 提供第一批裁判消息 / 可查询视图出口：`buildRefereeDecisionSnapshot` 和 `getRefereeMessages` 会把当前 interaction、response window、active resolution frame 和最近 EventCommit evidence 合成只读消息。它只读取已有系统状态，不发现新 opportunity、不创建交互、不推进窗口、不作为 UI / AI / 服务端验证的规则授权；玩家视角会隐藏其它玩家私有 interaction 候选，只保留“当前被其它玩家决策阻塞”的事实。
- `src/engine/RefereeReplay.ts` 提供第一批裁判证据回放摘要出口：可从 `PipelineResult` 或 `G.sys.refereeTrace` 汇总命令类型、事件类型序列、EventCommit 证据、trace entry 和当前决策面摘要，并可把摘要压成恢复观测用指纹片段。它是审计 / AI 反馈 / 线上诊断查询面，不重新 reduce、不执行响应、不生成新日志、不成为第二套事件源；玩家视角同样不得泄漏其它玩家私有候选。在线 AI 恢复、无解交互和命令失败反馈可携带该摘要；恢复 step key / tracker fingerprint 可读取其中的 response window、active frame、EventCommit trace 和阻塞交互摘要，用于判断裁判决策面是否真实变化，但不能据此授权规则或自动修正状态。
- `createResolutionFrameSystem` 是可选长事务 driver，不进入 `createBaseSystems` 默认集合。它只消费 active `ResolutionFrame` 已持有的 `deferredEvents`，把这些事件回灌进 pipeline 正式归约，并可在游戏显式提供 `shouldAutoCompleteFrame` 时完成空闲 frame / 恢复父 frame；blocked / suspended frame 不会被抢跑，`deferredActions` 没有通用执行宿主时不会被静默消费或因自动完成丢失。
- `createTimingOpportunitySystem` 是可选系统，不进入 `createBaseSystems` 默认集合。游戏只有命中本文需求触发条件时才显式加入。
- `createSimpleChoiceFromTimingOpportunity` 是 `Opportunity -> ChoiceRequest -> simple-choice` 的共享投影入口；旧链路需要保留 legacy interaction id 时，也应通过该 helper 覆盖 request id，不要在游戏层手写第二套投影。投影后的 ChoiceRequest 诊断摘要会携带 `opportunityId`，通用系统优先按该规则身份和 interaction id 去重，AI 决策元数据只作兼容回退，避免 legacy prompt 与新系统双重排队。
- 该系统当前能把 active opportunity 投影为现有 simple-choice 交互、游戏专用 interaction、打开 response window、push child frame，或追加领域事件给 afterEvents 管线继续归约。
- `commands` resolution 当前没有通用执行宿主；系统会明确报错，要求改成 `ChoiceRequest` 或由游戏层显式处理，禁止静默假执行。

旧窗口试点的具体游戏路径、阶段状态和历史证据不写进本标准；需要回查时看 [`../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md`](../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md)。本标准只保留可复用迁移口径：

- 旧 session、`pending*` 或专用 interaction 接入时，先投影成 `Opportunity -> ChoiceRequest` 合同，再决定是否切换开窗 owner；不得让旧结构和新合同同时独立发现同一响应。
- 旧 interaction id 可以作为兼容外壳保留，但规则身份、候选身份、跳过命令、AI 合法动作、服务端验证和恢复命令必须来自同一份 ChoiceRequest 候选。
- 合同存在时，玩家 UI、AI、恢复、教程脚本和验证链路不得按按钮上的对象 ID、数值或空 payload 自行重组命令；缺合同的裸旧窗口只能作为历史兼容 fallback。
- 响应关闭必须匹配 live ChoiceRequest、候选来源和对应 ResolutionFrame；匹配失败应暴露为内部合同错误，不能误关其它前台交互、响应 frame 或私有窗口。
- 同一笔长事务从一个响应者切到另一个响应者时，应复用同一规则身份或 frame 归属；不得为每个响应者生成互相脱节的续链。
- replacement / prevention 提交必须在正式归约前发现并留下 EventCommitEvidence；如果 live pending 已清理，必须能从 frame 或提交证据重建同一事件身份。
- 当前底座和 driver seam 不等于旧游戏已经完成迁移。迁移某个旧窗口时仍需写清旧入口、新 owner、已切走消费者、兼容 fallback、剩余删除条件和验证证据。

### TimingPoint

`TimingPoint` 是规则断点，至少应能表达：

- 来源事实：命令、事件、阶段变化、对象移动、伤害、计分、攻击、支付、抽牌、弃牌、清场、胜负检查。
- 位置：`before`、`replace`、`prevent`、`after`、`postCommit`、`phaseStart`、`phaseEnd` 或游戏声明的等价断点。
- 上下文：来源对象、控制者、影响对象、目标、事件批 ID、父 frame、可见性边界。
- 时效：本事件前有效、本事件后有效、本轮有效、持续检查、延迟触发。

常见断点包括但不限于：

- `beforeAction / afterAction`
- `beforeCardPlayed / afterCardPlayed`
- `beforeDamage / afterDamage`
- `beforeMove / afterMove`
- `beforeDestroy / afterDestroy`
- `beforeScoring / whenScoring / afterScoring`
- `phaseStart / phaseEnd`
- `eventCommit / postCommit`

### Opportunity

`Opportunity` 是时点生成出的规则机会，至少包含：

| 字段 | 要回答的问题 |
| --- | --- |
| `id` | 当前机会稳定身份是什么 |
| `timing` | 来自哪个 `TimingPoint` |
| `sourceRef` | 机会来源是卡牌、技能、Token、状态、规则还是场景 |
| `controllerId` | 谁拥有或决定该机会 |
| `class` | 强制、可选、响应、替代、防止、持续还是延迟 |
| `condition` | 当前事实下是否成立 |
| `cost` | 需要先支付什么，何时支付，失败是否回滚 |
| `targetRequest` | 是否需要目标、数量、顺序或模式选择 |
| `resolution` | 最终执行什么事件、命令或子 frame |
| `ordering` | 同时机会如何排序：显式、队列、轮询、栈式或规则指定 |
| `visibility` | 哪些玩家 / AI / 旁观者可见 |
| `aiSupport` | 共享策略、游戏策略或明确不支持 |

### Choice 和 Response

只要机会需要玩家或 AI 输入，就必须转成 `ChoiceRequest` 或 response window：

- 目标、模式、数量、顺序、是否执行、让过、确认都必须结构化表达。
- AI 必须消费同一份 choice/opportunity 合同，不得从 UI 文案、数组下标或按钮顺序猜。
- response window 只承载“当前响应者是谁、能否让过、窗口何时关闭”；它的可响应机会来自 Opportunity 发现结果。

### Resolution

接入本文模型后，跨事件批、交互、响应窗口、阶段推进、清场或 deferred follow-up 的链路应由 `ResolutionFrame` 承载：

- 父 frame 被子 frame 打断时，父 frame 保留恢复位点，子 frame 成为 active。
- 子 frame 完成后，driver 恢复父 frame，不要求游戏层另写私有恢复栈。
- deferred events/actions 由 frame 单一持有；共享 `createResolutionFrameSystem` 只自动回灌 `deferredEvents`，`deferredActions` 必须有游戏层正式 owner 或专用系统处理，不能由通用层猜执行语义。
- frame handler 返回推进结果：继续发事件、等待选择、打开响应窗口、push 子 frame、等待 post-reduce、完成。

### EventCommit

替代 / 防止必须发生在事件正式写入前；事实触发只能在事件正式改变状态后产生：

- 事件正式归约前优先走 `DomainCore.commitEvent`；旧 `interceptEvent` 只作为兼容拦截层，不应继续承载新复杂机制的主权威。
- 简单 replacement / prevention 可用 `commitEventWithTimingOpportunities` 直接发现并提交单个 `events` resolution；多个改写机会、需要领域专属顺序时，游戏必须通过 `composeEventCommitPlan` 提供显式提交计划；需要选择输入的机会必须在事件提交前已有响应窗口或其它正式阻塞入口，不得在 EventCommit 阶段新开选择。
- 提交阶段发现或应用的 replacement / prevention 机会必须留下 `EventCommitEvidence`，至少能追到原事件类型、命令类型、`eventCommit` 时点、机会时点、发现机会 ID 和实际应用机会 ID；证据是审计 / 回放 / 测试查询面，不是第二套规则状态。
- `replacement / prevention` 机会处理原事件是否取消、改写、缩小、重定向或转成其它事件。
- `trigger / response` 机会在对应事实落地后生成，除非规则明确写在事实前。
- preview 或只读投影不能创建真实 opportunity、interaction、response 或 continuation。

## 需求触发接入要求

当新游戏需求包含下列机制时，从机制建模阶段建立最小 Timing/Opportunity 矩阵；没有这些机制时，不为“统一”而引入这套框架：

- 每个阶段开始 / 结束。
- 每类核心动作、攻击、伤害、移动、计分、支付、清场、抽牌、弃牌、胜负检查。
- 每类可选、强制、响应、替代、防止和延迟效果。
- 每个 AI 可能参与的阻塞选择。

接入后的最低验收：

- 每个 opportunity 能追到 UI、服务端验证、执行 / reducer、AI legal-action 和日志 / 事件。
- 同一机会只有一个规则真相源；UI、AI、validator 不各写一套条件。
- response window 只是承载层，不是机会发现器。
- 接入后的长事务应有 frame owner；不能只靠 `continuationContext`、`pending*` 或按钮状态续链。

## 旧游戏兼容和迁移

旧游戏允许保留历史实现，但按以下规则迁移：

- 未触碰的旧 `simple-choice`、`pending*`、`continuationContext`、私有 session 可继续兼容。
- 触碰触发、响应、替代、防止、长事务、AI 阻塞或线上恢复卡点时，先判断是否接入本文模型。
- 如果必须暂留 adapter，adapter 只能把旧入口映射到新的 opportunity/frame，不能继续成为第二套规则权威。
- 迁移文档必须写清：旧入口是什么、新 owner 是什么、哪些消费者已切走、剩余删除条件是什么。

首个迁移试点应补齐 Opportunity 层，至少覆盖一种高风险链路：计分、响应、替代、防止或延迟 follow-up。第二个验证场景应选择不同机制家族，避免用单一游戏外推为通用结论。

## 禁止项

- 有触发 / 响应 / 替代 / 防止 / 长事务需求的新链路，不要把主响应链写成私有 `pending* / continuationContext / reactionStack / actionCounterStack`。
- 禁止 UI 按钮列表、卡牌高亮、弹窗 kind 或选项文案成为机会真相源。
- 禁止 AI 用按钮文案、数组下标、翻译文本或 fallback 猜合法动作。
- 禁止 ResponseWindow 自己代表“所有可响应事实”；它只能承载已发现机会。
- 禁止 `ResolutionFrame` 只做门控标记，而长事务恢复点继续由游戏私有 session 持有。
- 禁止为了兼容旧入口新增第二套影子状态、去重表或静默兜底；内部不变量破坏时应暴露错误来源。

## 和现有标准的关系

- 引擎总览见 [`engine-systems.md`](engine-systems.md)。
- 玩家选择、权限矩阵、UI / AI 同源见 [`rule-driven-interaction-design.md`](rule-driven-interaction-design.md)。
- 响应和在线 AI 私有视图边界见 [`engine-transport.md`](engine-transport.md)。
- YGOPro 对照和吸收分析见 [`../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md`](../../../docs/refactor/ygopro-timing-opportunity-absorption-2026-08-21.md)。
