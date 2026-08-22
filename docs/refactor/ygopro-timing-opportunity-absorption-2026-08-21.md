# YGOPro 时点响应模型吸收对照

日期：2026-08-21

## 结论

`Fluorohydride/ygopro` 不是纯前端，也不是给 Web 项目直接接入的后端服务。它的核心价值是一个单游戏裁判架构：原生客户端负责展示与输入，`ygopro-core` 负责规则状态机和 Lua 脚本处理，卡牌资料放在 SQLite `cdb`，牌组放在文本 `ydk`，卡牌效果放在 Lua 脚本。

本项目不应吸收它的代码、UI、素材或 GPL 脚本；应吸收的是规则裁判模型：规则核心推进到时点，发现可触发 / 可响应 / 可替代 / 可防止的机会，必要时暂停并等待玩家或 AI 提交响应，再由同一条结算主链恢复。

当前项目不是“完全没有这些东西”，而是已经有碎片：

- `ChoiceRequest` 已能表达玩家或 AI 的选择合同。
- `ResolutionFrame / ResolutionState` 已能表达连续结算帧骨架。
- `ResponseWindowSystem` 已能承载响应者队列与让过。
- `InteractionSystem`、AI 决策视图、传输层和 `playerView` 已有承载层。

真正缺的是统一主模型：`TimingPoint -> Opportunity -> ChoiceRequest / ResponseWindow -> ResolutionFrame -> EventCommit`。这不是“过去完全没做”，而是已经有多个平台原语，却还没有闭合成一个裁判内核。没有这一层时，每个复杂游戏会继续把 `pending*`、`continuationContext`、私有 reaction queue、私有 action counter 栈和 UI / AI 合法动作各写一套，长期会越来越乱。

## YGOPro 值得吸收什么

不是只有时点响应模型值得吸收。时点模型只是这套 TCG 裁判框架里最先应该抽出来的平台主轴；围绕它还有效果生命周期、事件改写、裁判消息协议、静态资料分层、可查询视图、确定性回放和配置导入导出等能力。区别只在于：这些能力不能被写成“所有游戏强制接入”，而应按游戏真实机制需要分层启用。

### TCG 裁判框架可吸收分层

吸收时必须拆成两层：

- 常驻底座：命令 / 事件 / 校验、结构化选择、可见视图、AI 合法动作、静态资料分层、审计回放和能力定义合同。所有游戏都应沿用这些平台原语，避免各写各的真相源。
- 按需机制：时点机会发现、响应窗口、替代 / 防止、结算栈、复杂效果生命周期、脚本沙箱和牌组导入。只有游戏机制命中时才打开对应 driver；不命中时平台能力应保持零入口或空发现结果。

| 层级 | 可吸收能力 | 对本项目的意义 | 接入口径 |
| --- | --- | --- | --- |
| P0 | 时点 / 机会 / 响应模型 | 统一“什么时候谁能触发、响应、替代、防止”，避免各游戏继续私写 `pending*`、reaction queue 和 action counter 栈 | 有触发、响应、替代、防止、长事务或 AI 阻塞时接入 |
| P0 | 效果生命周期模型 | 把条件、费用、目标、执行、持续、失效、次数限制、来源和控制者放进同一能力合同 | 有卡牌效果、技能、Token 能力、持续状态或一次/每回合限制时接入 |
| P0 | 事件改写 / 替代 / 防止模型 | 在事件正式落地前处理取消、缩小、重定向、减伤、护盾、复活和替代支付 | 有 damage prevention、replacement、cancel、redirect、shield、revive 等机制时接入 |
| P0 | 结算栈 / 长事务 driver | 用父子 frame 恢复和 deferred ownership 取代游戏私有续链 | 有多步结算、连锁响应、战斗窗口、清场后续或跨事件批流程时接入 |
| P0 | 合法动作查询 / 裁判消息协议 | 规则核心输出结构化选择和响应窗口，UI、AI、服务端验证消费同一份合同 | 任何阻塞选择、隐藏选择、AI 决策或在线恢复都应消费 |
| P1 | 静态资料 / 运行时状态 / 脚本分离 | 卡牌资料、牌组、能力脚本、素材、运行时状态各归其位，避免文案或 UI 成为规则真相源 | 配置型游戏、卡牌游戏、可扩展内容包默认采用这种分层 |
| P1 | 可查询裁判状态 | 给 UI、AI、日志、观战和审计提供同源只读视图，不让消费者猜内部状态 | 有 playerView、AI legal-action、提示高亮、回放审计时接入 |
| P1 | 确定性回放 / 测试模型 | 命令、响应、随机游标和事件提交可复现，复杂规则可做红测和回归 | 复杂规则、线上对局、AI 决策和 bug 复盘场景优先接入 |
| P2 | 牌组 / 初始配置导入导出 | 参考 `.ydk` 的轻量可分享思路，只保存 setup 数据，不混运行时状态 | 有卡组、剧本、地图包、角色包或用户配置分享时接入 |
| P2 | 脚本沙箱与注册机制 | 学习“效果以受控接口注册”的思想，为未来 UGC、配置生成和 AI 生成能力留边界 | 先设计接口和权限边界，不直接引入外部 Lua/GPL 脚本 |

### 仍然只参考或排除的部分

- 单游戏专属规则常量，例如 Yu-Gi-Oh! 的区域编号、连锁速度、卡种细节和禁限表语义。
- GPL 主仓库、官方 Lua 卡牌脚本、卡图、声音、贴图和 IP 内容。
- 原生桌面 UI、Irrlicht 渲染和快捷键。
- “所有游戏都套同一个 TCG 栈”的做法。BoardGame 是多桌游平台，TCG 是压力测试样本，不是平台唯一形状。

| 参考点 | YGOPro 做法 | 本项目应吸收的抽象 |
| --- | --- | --- |
| 规则核心 | `ygopro-core` 通过 `process()` 推进裁判状态，`get_message()` 输出需要外部处理的消息，`set_responsei()` / `set_responseb()` 接收外部选择 | 引擎 driver 推进到阻塞点，输出结构化 `ChoiceRequest` / response window，收到响应后恢复同一条 frame |
| 数据分离 | 主仓库用子模块连接 `ocgcore` 和 `script`；卡牌资料、脚本、牌组、UI 目录分离 | 游戏配置、规则能力、选择合同、素材和运行时状态分离，禁止 UI 或按钮文案成为规则真相源 |
| 卡牌效果 | Lua 脚本用 `Effect.CreateEffect` 注册 `SetType / SetCode / SetCondition / SetTarget / SetOperation` | 能力定义必须拆出时点、条件、费用、目标、执行、AI 支持和可见性 |
| 牌组文件 | `ydk` 是 `#main / #extra / !side` 分段的卡牌编号列表 | 牌组 / 初始配置应是可导入导出的轻格式，不把运行时状态混进去 |
| 卡牌数据库 | `cdb` 读取 `datas` 与 `texts` 表，资料和文案是静态资料源 | 静态资料只提供事实属性、文案和索引，不承载运行时结算状态 |

## 不吸收什么

- 不复制 `gframe` 原生 UI、Irrlicht 渲染、桌面快捷键和窗口逻辑。
- 不复制官方卡图、声音、贴图或游戏 IP 内容。
- 不把 GPL-2.0 的主仓库或 Lua 脚本并入本项目源码。
- 不把单游戏 Yu-Gi-Oh! 规则常量照搬成平台层常量。
- 不把“所有效果都是 LIFO 栈”误当成通用结论；桌游还会有显式顺序、队列顺序、同时触发排序、隐藏选择和阶段收口。

## 我们当前强在哪里

- 项目是多桌游平台，不是单一 TCG 模拟器；已有 React / Vite 前端、Node 在线服务、自研传输层、AI 决策视图和 `playerView` 隐私过滤。
- `ChoiceRequest` 已把候选 ID、跳过策略、AI 策略、诊断和合法动作投影做成结构化合同。
- `ResolutionFrame` 已经进入 `SystemState`，并和 `InteractionSystem / ResponseWindowSystem / FlowSystem` 有基础门控关系。
- 项目已有规则驱动交互规范，强调 UI、命令验证、AI、自动推进要消费同一份授权真相。

这些能力比 `ygopro` 更适合 100 个左右桌游的长期平台，但它们还没有被一个“时点机会发现器”串起来。

## 我们当前弱在哪里

| 缺口 | 现实后果 | 当前证据 |
| --- | --- | --- |
| 没有统一 `TimingPoint` | 规则事件发生前后没有稳定断点，触发 / 响应 / 替代 / 防止只能各游戏自己找时机 | `DomainCore` 只有 `postProcessSystemEvents` 和 `interceptEvent`，缺少统一时点对象 |
| 没有统一 `Opportunity` | 什么时候谁能响应、谁必须触发、谁能替代原事件无法结构化枚举 | `ResponseWindowSystem` 需要游戏注入 `hasRespondableContent`，但它不是机会真相源 |
| `ResolutionFrame` 仍缺完整 frame handler | 最小 driver 已能回灌 frame 持有的 deferred events 并在显式条件下完成空闲 frame；但多步推进、游戏专用 deferredActions 和完整 handoff 仍需按游戏机制接 owner | `src/engine/systems/ResolutionFrameSystem.ts` 已补最小事件 driver；复杂 action 执行仍不能由通用层猜 |
| 游戏私有续链仍在增长 | 旧游戏和复杂派系继续用 `pending* / continuationContext / reactionSession` 自己续命 | SmashUp `reactionSession` 已半迁入 frame，但 `actionCounter` 仍有私有 stack；DiceThrone 的 `pendingDamage` Token 响应已纳入 Opportunity 试点，但 Betrayal、Qidahen 和其它 pending 运行态仍需逐项审查 |
| UI / AI 容易重复猜合法动作 | 玩家按钮、AI legal-actions、服务端 validate 会出现相似但不等价条件 | 现有规范已反复禁止这类问题，说明它是复发风险 |

## 应建立的平台模型

```text
Domain Event / Command
  -> TimingPoint（规则断点）
  -> OpportunityDiscovery（发现机会）
  -> Opportunity（强制 / 可选 / 响应 / 替代 / 防止 / 持续）
  -> ChoiceRequest 或 ResponseWindow（玩家 / AI 输入承载）
  -> ResolutionFrame（长事务、父子恢复、deferred ownership）
  -> EventCommit（正式归约、触发下一批时点）
```

关键边界：

- `TimingPoint` 是规则事实断点，不是 UI 步骤名。
- `Opportunity` 是合法机会真相源，不是按钮列表。
- `ChoiceRequest` 是选择合同，不是弹窗实现。
- `ResponseWindowSystem` 是响应承载层，不负责自己发现所有可响应内容。
- `ResolutionFrame` 是连续结算事务权威，不应被 `continuationContext` 或游戏私有栈抢主权威。
- `EventCommit` 前处理替代 / 防止，事件正式落地后再产生事实触发。

## 当前实施状态

第一批平台底座已经落到共享引擎，但仍是 opt-in，不会自动改变旧游戏行为：

- `src/engine/TimingOpportunity.ts` 已新增 `TimingPoint`、`Opportunity`、机会发现 runner、机会校验，以及投影到 `ChoiceRequest`、response window 和 `ResolutionFrame` 的 helper。`src/engine/primitives/ability.ts` 已补 `AbilityLifecyclePhase`、`AbilityLifecycleRef`、`buildOpportunityFromAbilityDef` / `createAbilityOpportunity`，让能力定义能在具体规则时点投影为 Opportunity 合同，覆盖来源、控制者、条件、费用、目标、结算入口、可见性和 AI 元数据；`createAbilityChoiceContract` 已补能力输入面的共享子合同，统一 request / candidate 的 ability provenance 和候选 action key。该 helper 不执行效果、不支付费用、不写状态。
- `DomainCore.discoverTimingOpportunities` 已成为可选发现入口；旧游戏不实现时返回空机会和空诊断。
- `DomainCore.commitEvent` 已成为事件正式归约前的可选提交入口；它接收完整 `MatchState`、当前命令和 `eventCommit` 时点，可取消、改写或拆分事件，旧 `interceptEvent` 保留为后置兼容层。
- `commitEventWithTimingOpportunities` 已成为最小共享 EventCommit driver：在正式归约前用 `replace` / `prevent` 时点发现 replacement / prevention 机会，统一校验、排序和提交单个安全 `events` resolution；`none` resolution 只作为证据，多事件改写机会或会阻塞提交的 resolution 默认拒绝；游戏可通过 `composeEventCommitPlan` 显式合成提交计划。
- `EventCommitEvidence` 和 `PipelineResult.eventCommitEvidence` 已成为第一批可查询裁判证据出口；replacement / prevention 机会被发现或应用时，结果能追到原事件、命令类型、`eventCommit` 时点、机会时点、发现机会和实际应用机会。普通无机会事件不生成证据噪音，自定义 `commitEvent` 需要通过 `{ events, evidence }` 显式携带证据。
- `src/engine/systems/RefereeTraceSystem.ts` 已成为基础系统集合里的常驻审计出口，把当前事件轮次的 `EventCommitEvidence` 写入 `G.sys.refereeTrace`；它服务测试、回放、线上诊断和裁判视图查询，不作为玩家行动日志、表现事件或第二套规则状态。
- `src/engine/RefereeView.ts` 已补第一批裁判消息 / 可查询视图出口：`buildRefereeDecisionSnapshot` 和 `getRefereeMessages` 会把当前 interaction、response window、active resolution frame 和最近 EventCommit evidence 合成只读消息，接近 YGOPro `get_message()` 的平台抽象，但不发现 opportunity、不创建交互、不推进窗口、不参与规则授权；玩家视角会隐藏其它玩家私有 interaction 候选。
- `src/engine/RefereeReplay.ts` 已补第一批裁判证据回放摘要出口：可从 `PipelineResult` 或 `G.sys.refereeTrace` 汇总命令类型、事件类型序列、EventCommit 证据、trace entry 和当前决策面摘要；在线 AI 恢复、无解交互和命令失败反馈会按玩家视角携带该摘要，恢复 step key / tracker fingerprint 也会消费其中的 response window、active frame、EventCommit trace 和阻塞交互摘要，避免把裁判决策面真实变化误判成 no-progress。它不是完整 deterministic replay 执行器，不重新 reduce、不执行响应、不生成第二套事件源，只服务审计、测试、AI 反馈和线上诊断查询。
- `src/engine/systems/ResolutionFrameSystem.ts` 已补最小可选长事务 driver：active frame 如果持有 `deferredEvents` 且没有 blocked / suspended，就把这些事件回灌进 afterEvents 管线正式归约；只有游戏显式提供 `shouldAutoCompleteFrame` 时才自动完成 frame 并恢复父 frame；`deferredActions` 没有通用执行宿主时不会被静默消费或丢弃。
- `src/engine/systems/TimingOpportunitySystem.ts` 已新增可选系统，可把 active opportunity 投影为现有 simple-choice、游戏专用 interaction、response window、child frame，或把 `events` resolution 追加回 afterEvents 管线。
- `createSimpleChoiceFromTimingOpportunity` 已作为共享投影入口，支持旧链路保留 legacy interaction id，同时仍把 opportunity 元数据、ChoiceRequest 诊断和 AI 决策语义写入同一交互；通用系统优先按 ChoiceRequest 诊断摘要中的 `opportunityId` 和 interaction id 去重，AI 决策元数据只作兼容回退，避免 legacy prompt 与新系统双重排队。
- `commands` resolution 暂不由共享系统直接执行；它会明确报错，要求改成 `ChoiceRequest` 或由游戏层显式处理，避免“看似结算、实际丢失”的静默失败。
- `createBaseSystems` 没有默认加入 TimingOpportunitySystem / ResolutionFrameSystem；新游戏或旧游戏迁移只有命中触发、响应、替代、防止、长事务、deferred follow-up 或 AI 阻塞需求时才接入。
- SmashUp 已补第一条旧链路映射：`src/games/smashup/domain/reactionTimingOpportunity.ts` 把既有 `SmashUpReactionSession` 的当前响应候选定义为通用 `Opportunity -> ChoiceRequest` 合同，`src/games/smashup/domain/timingOpportunities.ts` 将它挂到 `SmashUpDomain.discoverTimingOpportunities`，并提供 `createSmashUpTimingOpportunitySystemConfig`。`src/games/smashup/game.ts`、AI 模拟 pipeline 和测试 runner 已显式加入 `TimingOpportunitySystem`；旧生产响应链的弹窗生成已复用同一 ChoiceRequest 合同，但仍保留原 session 执行链和旧 interaction id，当前通过 `opportunityId` 去重避免双重排队。下一步才是受控切换 owner。
- DiceThrone 已补第二条不同机制家族映射：`src/games/dicethrone/domain/timingOpportunities.ts` 把既有 `pendingDamage` Token 伤害响应定义为通用 `Opportunity -> ChoiceRequest` 合同，并挂到 `DiceThroneDomain.discoverTimingOpportunities`。`src/games/dicethrone/game.ts` 已显式加入 `TimingOpportunitySystem`，通过 `createDiceThroneTimingOpportunitySystemConfig` 投影到既有 `dt:token-response` 专用交互；`src/games/dicethrone/domain/systems.ts` 不再在 `TOKEN_RESPONSE_REQUESTED` 后直接创建旧窗口。通用系统当前负责机会发现、合同投影、开窗和去重；DiceThrone 玩家 UI、服务端验证、AI、强制恢复和离线断线裁决在合同存在时优先从 `ChoiceRequest` 投影 `USE_TOKEN` / `SKIP_TOKEN_RESPONSE` 合法动作，服务端验证只接受合同候选命令，合同命令与 UI / 恢复 / 验证链路开始携带并校验 `pendingDamageId`，把响应绑定到具体待响应伤害对象；执行入口会把合同来源直接传入 Token 使用和跳过收口，执行事件记录来源 `requestId`、候选 id、`opportunityId` 和 `resolutionFrameId`，最终 `DAMAGE_DEALT` 也会携带同一 frame 归属；`TOKEN_RESPONSE_CLOSED` 带来源时必须匹配当前或队列中的 live 合同和对应 frame 才会关闭对应交互，不会误关前台卡牌 / 骰子交互或其它响应 frame；强制恢复会返回合同 skip 候选里的完整命令，离线断线裁决会从同一候选派生命令类型，且恢复指纹包含合同候选摘要；裸旧 `dt:token-response` 只保留历史兼容 fallback。`USE_TOKEN` / `SKIP_TOKEN_RESPONSE` 的伤害数值归约和旧恢复策略仍由既有 DiceThrone 链路承载。
- Mage Wars 已补第三条不同机制家族映射：`src/games/mage-wars/domain/objectAbilityRuntime.ts` 的 `buildMageWarsSelfObjectAbilityActivationOpportunity` 会把固定费用、自身确认型对象能力投影为 `AbilityDef -> Opportunity -> ChoiceRequest` 合同，候选命令直接复用正式 `USE_ARENA_OBJECT_ABILITY` payload，验证失败时保留 inactive opportunity 和 disabled candidate。该入口当前只读，不创建 interaction、不改 Board pending 状态、不枚举目标型能力；治疗、装备绑定、多模式选择和 UI / AI 消费者切换仍待后续 Contract-Carrying Migration。

本轮继续推进 DiceThrone 试点：`dt:token-response` 的玩家 UI 在合同存在时直接派发 `ChoiceRequest` 候选里的原始命令；AI 合法动作在合同存在时复用同一合同投影，在裸旧 `pendingDamage` 兼容路径中也会携带 `pendingDamageId`；强制恢复没有合同时会从旧交互 id 或诊断数据尽量恢复同一个伤害 ID；正式教程 AI 脚本不再手写空 `SKIP_TOKEN_RESPONSE` payload，而是通过当前 `ChoiceRequest` 的 `skip` 候选补全 live 命令。这样 UI / AI / 恢复 / 教程脚本不再按按钮上的 `tokenId / amount` 或空 payload 自行重组响应命令，合同命令里的 `pendingDamageId`、候选身份和后续验证保持同源。合同存在时，服务端验证和执行来源匹配不再允许省略 `pendingDamageId`；只有真正缺少合同和旧交互伤害 ID 的历史窗口才保留空 payload fallback。Token 响应现在会先建立按 `pendingDamage.id` 归一的 `ResolutionFrame`，`dt:token-response` 交互会绑定并阻塞该 frame，`TOKEN_RESPONSE_CLOSED` 匹配合同和 frame 后完成该 frame；同一笔伤害从攻击方响应切到防御方响应时复用同一 frame，不再为每个响应者生成悬空私有续链。合同来源会把 `resolutionFrameId` 写入 Token 使用、响应关闭和最终伤害提交事件，保证日志、测试和后续 EventCommit 收口能追回同一个 frame；这仍是提交归属和校验，不代表伤害 reducer 已整体迁成 frame handler。DiceThrone 也开始暴露第三类机制：在 `prevent damage` 时点，已有 `damageShields` 会作为 `prevention` Opportunity 被发现，bypass shields 和 ultimate damage 不再暴露假防止机会；`src/games/dicethrone/domain/damagePreventionCommit.ts` 已成为 DiceThrone 伤害防止提交的单一 Module，Token 响应开窗前的护盾后伤害估算和正式护盾消耗都复用同一入口；`DiceThroneDomain.commitEvent` 会先通过 `commitEventWithTimingOpportunities` 发现和校验防止机会，再用 `composeEventCommitPlan` 合成并返回护盾提交事件，在 `DAMAGE_DEALT` 正式归约前提交护盾防止，写入 `preventionCommitted` 和 `shieldsConsumed`，reducer 只消费该提交结果并保留未标记旧事件的兼容计算；当正式 `DAMAGE_DEALT` 来自同一 Token 响应 frame 时，即使 live `pendingDamage` 已被响应关闭清理，防止机会发现也会从 `resolutionFrameId` 重建同一笔伤害身份，护盾消耗记录会携带 `pendingDamageId`、`resolutionFrameId` 和对应 `preventionOpportunityId`，让正式伤害提交能追溯到同一个防止机会。当前已经建立最小 EventCommit driver，可处理单一 `events` 型 replacement/prevention 提交计划，也支持游戏用 `composeEventCommitPlan` 显式合成多机会提交计划；但尚未提供跨游戏自动排序 / 合成默认算法，也未把伤害 reducer 整体迁成 prevention frame handler；旧裸 `DAMAGE_DEALT` 不会凭空生成防止机会归属。该变化仍不代表 DiceThrone Token 响应完全迁完，伤害数值归约和更广泛 replacement/prevention 执行 owner 仍待后续单独切换。

## 按需接入要求

新游戏只有在需求包含以下任一能力时，才接入时点-机会-结算模型；没有这些能力时，不为了“统一”而引入这套框架：

- 触发、被动、持续、回合开始 / 结束效果。
- 响应、打断、反制、取消、改写。
- 替代、防止、减伤、护盾、复活、重定向。
- 多步选择、可选效果、至多 / 任意数量、隐藏信息 prompt。
- 战斗、伤害、计分、清场、回合外行动、额外行动。
- AI 座位可能参与的任何阻塞交互。

接入后的最低产物：

- `TimingPoint / Opportunity` 矩阵。
- 每个机会的来源、控制者、触发条件、费用、目标请求、执行器、可见性和 AI 支持。
- 每个机会能追到同一个 `ChoiceRequest` / response window、服务端验证、UI 展示、AI legal-action 和 resolution frame。

## 旧游戏兼容策略

旧项目可以保留兼容，不做大爆炸迁移；但不能把兼容层继续升级为新主线。

- 未触碰的旧 `pending* / continuationContext / simple-choice / 私有 session` 可保留。
- 一旦修改某个旧窗口的触发、响应、替代、防止、长事务、AI 卡点或线上恢复，就必须判断能否迁到 `TimingPoint / Opportunity / ResolutionFrame`。
- 迁移时保留薄 adapter，但文档要写清它代理哪个旧入口、由哪个新 frame 或 opportunity 接管、删除条件是什么。
- SmashUp 作为第一试点，继续完成已有 `add-resolution-stack-system`，并补上 `Opportunity` 层；DiceThrone 已作为第二个非 SmashUp 伤害响应验证场景，Mage Wars 已作为第三个能力发动验证场景。后续再选替代 / 防止或完整目标枚举这类不同机制族验证。

## 重构顺序

1. 先补项目标准：把时点-机会-结算作为平台级规则内核，不再视为 TCG 特例。
2. 在引擎层补 `TimingPoint / Opportunity` 类型和发现接口，先不改变旧游戏行为。
3. 完成现有 resolution driver：父子 frame、resume point、completion handoff、deferred ownership。
4. 让 Opportunity 能输出 `ChoiceRequest`、打开 response window 或 push child frame。
5. 迁移 SmashUp 计分 / afterScoring / action counter 代表链，删除或降级私有主链权威。
6. 选第二个非 SmashUp 场景验证伤害 / 响应 / 替代链路。
7. 新游戏创建流程按需求判断是否加入 Timing/Opportunity 矩阵；旧游戏按触碰窗口渐进迁移。

## 资料来源

- `Fluorohydride/ygopro` 主仓库 README、目录和子模块：`https://github.com/Fluorohydride/ygopro`
- `ygopro-core` API 与 README：`https://github.com/Fluorohydride/ygopro-core`
- `ygopro-scripts` Lua 示例：`https://github.com/Fluorohydride/ygopro-scripts`
- 本项目源码：`src/engine/types.ts`、`src/engine/ChoiceRequest.ts`、`src/engine/systems/resolutionStack.ts`、`src/engine/systems/ResponseWindowSystem.ts`、`src/games/smashup/domain/reactionSession.ts`、`src/games/smashup/domain/actionCounter.ts`
- 本项目现有提案：`openspec/changes/add-resolution-stack-system/`
