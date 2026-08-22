---
name: engine-systems
description: 引擎系统总览：共享原语、事件、FX、AI 和状态边界——改共享引擎能力时查
metadata:
  type: doc
  status: 已交付
---

# 引擎与框架系统总览

本文件是引擎 / 框架层的入口和职责边界，不承载具体游戏案例、长代码模板或专项系统百科。修改传输、交互、动画、能力、伤害、日志、结束态等细节时，按本文件路由到对应标准。

## 状态分层

- `G.core`：游戏领域状态，只保存会被规则结算、校验、胜负或 AI 决策消费的事实。
- `G.sys`：系统状态，保存 interaction、undo、log、gameover、flow halted、response window 等跨游戏能力。
- `G.sys.gameover` 是游戏结束结果的唯一读取入口；胜负细则见 [`engine-gameover`](engine-gameover.md)。
- EventStream、FX、视觉缓冲和特写只承载表现时序，不改变正式规则事实。

## 时点-机会-结算入口

复杂触发、响应、替代、防止、长事务和 AI 阻塞的主合同见 [`timing-opportunity-resolution`](timing-opportunity-resolution.md)。新游戏只有在需求涉及这些能力时，才建立 `TimingPoint / Opportunity` 矩阵；旧游戏触碰相关窗口时先判断是否迁移，避免继续新增私有 `pending* / continuationContext / reactionStack` 作为主结算权威。

## 平台 / 游戏边界

- `src/engine/` 和 `components/game/framework/` 是平台内核 / 框架层。它们可以在做具体游戏时演进，但进入共享层前必须抽象成通用状态、通用时序、通用交互、通用传输或通用计算合同。
- 共享层不得写具体游戏名、卡牌名、阵营名、反馈编号、私有流程或 UI 特例。
- 游戏层可以有自己的 domain、adapter、UI extension、数据转换和少量重复实现。单游戏独有、尚未稳定或只是减少重复的逻辑先留在游戏层。
- 改 engine / framework 前必须说明平台缺口是什么、游戏层扩展为什么不足、其它游戏如何受益或如何不受影响。
- engine / framework diff 应能单独审查；不要把平台演进埋在某个游戏改动里。

## 领域事务

- 复杂结算必须只有一个权威事务宿主。计分、战斗、响应轮、清场、换区、换对象等链路，只能有一个地方决定当前结算位点、阻塞原因和恢复入口。
- 会改变对局事实的领域事件只能由 pipeline 正式归约一次。不得先把未来事件 reduce 进 core，再手工回滚或拼回 sys。
- UI 高亮、AI 估值、合法选项探测和动画预览可以构造只读投影；投影不能保存进 `MatchState`，也不能生成真实 interaction、reaction、trigger 或 continuation。
- 同一个响应轮只能有一个权威。旧入口兼容只能做薄 adapter，并写清消费者和删除条件。
- 事实触发只从事实事件产生。discard、leave-play、destroy、reveal、damage 等触发必须等对应事件正式改变状态后再生成。
- 视觉延迟不进入规则事务。动画等待、展示停顿和读本节奏由客户端表现层消费事件流处理。

## execute 边界

- `execute` 的职责是“命令 -> 基础事件”，可以读 `state.core`、调用纯函数、返回事件数组。
- `execute` 不调用触发链、不 reduce 模拟状态、不直接改 `state.sys`、不创建 interaction。
- 派生触发、后处理事件和响应轮续链统一在后处理阶段或专用系统中处理。
- 同一领域事件不得在命令执行层和后处理阶段重复触发。修重复触发时删除抢权入口，不补去重兜底。
- 审查 `execute.ts` / `reducer.ts` 时，确认命令只生成基础事件，触发链和系统状态写入没有被塞回领域执行层。

## 引擎原语

| 目录 / 模块 | 职责 | 细则 |
| --- | --- | --- |
| `engine/systems/` | Flow、Interaction、Undo、Log、EventStream、RefereeTrace、ResolutionFrame、ResponseWindow、Tutorial、Rematch、Cheat、ActionLog | 系统状态写 `G.sys`；RefereeTrace 只保存裁判审计证据，不参与规则授权；ResolutionFrame driver 只回灌 frame 已持有的 deferred events，不猜游戏动作 |
| `engine/RefereeView.ts` | 裁判消息和可查询决策快照 | 只读投影 interaction、response window、resolution frame 和 RefereeTrace；不写 state、不授权规则 |
| `engine/RefereeReplay.ts` | 裁判证据回放摘要 | 从 PipelineResult 或 RefereeTrace 汇总命令、事件、EventCommit 证据和决策面；不重新 reduce、不生成第二套事件源 |
| `engine/primitives/ability.ts` | 能力定义、执行器注册表和 `AbilityDef -> Opportunity` 生命周期投影 | 见 [`engine-ability-framework`](engine-ability-framework.md) |
| `engine/primitives/abilityConstraints.ts` | 行动、资源、状态、次数等通用约束 | 见 [`engine-ability-framework`](engine-ability-framework.md) |
| `engine/primitives/damageCalculation.ts` | 伤害计算、修正收集、breakdown | 见 [`engine-damage-pipeline`](engine-damage-pipeline.md) |
| `engine/primitives/spriteAtlas.ts` | 精灵图集注册、裁切、查询 | 本文件下方保留最小规则 |
| `engine/primitives/uiHints.ts` | 可交互实体派生查询 | 不写入 core |
| `engine/fx/` | FxBus、FxRegistry、FxLayer、FeedbackPack、Shader | 见 [`animation-effects`](animation-effects.md) |
| `engine-transport` | socket、dispatch、Provider、Board props、乐观传输、本地视角 | 见 [`engine-transport`](engine-transport.md) |

## 精灵图集

- `globalSpriteAtlasRegistry` 的 `image` 是可直接用于运行时的 WebP URL。
- `CardPreview.cardAtlasRegistry` 的 `image` 是 base path，由图片工具构建实际 URL。
- 两个注册表语义不同，禁止合并。
- 裁切算法统一调用 `computeSpriteStyle` / `computeSpriteAspectRatio`，不要在游戏层重复写百分比计算。
- 每个游戏只保留一个“卡牌 / 对象 -> 图集配置”的解析函数；手牌、棋盘、预览、弃牌堆和构建器都调用它。
- 新增图集类型只改解析函数，不改每个消费点。

## 能力与交互

- 新游戏涉及可配置技能、卡牌效果、Token 能力或等价能力注册需求时，使用 `AbilityRegistry` / `AbilityExecutorRegistry`，避免自建注册表或全局单例。能力存在触发、响应、替代、防止、持续或延迟生命周期时，用 `buildOpportunityFromAbilityDef` / `createAbilityOpportunity` 投影为 `Opportunity`；能力需要玩家或 AI 输入时，用 `createAbilityChoiceContract` 统一 request / candidate provenance，再按需求接 `ChoiceRequest`、response window、`ResolutionFrame` 或 `EventCommit`。
- 通用约束写在 `AbilityDef.validation` / `constraints`，不要在 UI、validate 或 execute 里按 ability id 手写分支。
- 技能按钮由 `AbilityDef.ui` 和通用组件消费，不在 UI 里硬编码 ability id。
- 技能描述由 i18n 和 `AbilityDef.description` 指向，卡牌配置只保留 ability id。
- 旧 `createSimpleChoice` 只作兼容；新阻塞交互按 [`rule-driven-interaction-design`](rule-driven-interaction-design.md) 和 [`engine-simple-choice`](engine-simple-choice.md) 裁决。
- 当前是否忙碌优先消费 `sys.interaction.current`、response window 和共享 hook，不要在游戏 Board 自建另一套“等待玩家输入”状态机。

## 框架复用

- 三层模型：`core/ui` 契约层，`components/game/framework` 骨架层，`games/<gameId>` 游戏层。
- 新增前先搜 `core/`、`components/game/framework/`、`engine/` 是否已有接口、Provider、Hook、注册表或槽位。
- 框架层不能 import 游戏层；游戏特化通过注册、adapter、slot 或 extension 注入。
- 系统命令由 adapter 合并，游戏层只列业务命令。
- Move payload 必须是对象，禁止裸值；系统命令用常量。
- 需要 `reset()` 的系统必须保证重开后回到初始值。
- `_noSnapshot` 只用于前一操作的后续动作，表示 undo 与前一个命令原子回退。

## Flow 与阶段

- `FlowSystem.afterEvents` 单次 pipeline 只允许基于事件自动跨一个阶段；更长链路必须由后续命令或明确系统续链推进。
- `sys.flowHalted` 表示阶段退出被 halt 后的恢复状态。业务数据不得增加重复的 `phaseExitHalt` 之类标记。
- `onPhaseEnter` 需要创建 interaction 或改 sys 时，返回 `{ events, updatedState }`；不要直接变异传入的 `state.sys`。
- 阶段推进是规则动作。UI、命令验证、AI legal-actions、自动推进和 watchdog 必须消费同一份阶段推进授权真相。
- 存在 response window、interaction、私有 prompt、deferred / finalize 或其它阻塞时，阶段按钮默认不可见或不可用；只有权限矩阵明确允许才开放。

## UIHints

- UIHints 是派生查询，不进入 core。
- 游戏层实现 `UIHintProvider<TCore>` 返回可交互实体；UI 层用共享 helper 提取位置和分组。
- 动态赋予的持续效果、保护、限制、临时 buff / debuff 和条件触发应有可见提示。展示方式不明确时先问用户，不猜 UI。

## 领域建模

新增或主动审查机制前，先从规则文本建立领域模型，不要直接写实现。

最低产物：

- 术语和状态的精确定义。
- 概念到事件 / 状态字段的映射。
- 玩家决策点清单：强制、可选、无决策。
- 当前引擎能力缺口和扩展计划。

如果规则说“被影响”“可选择”“直到”“额外”等抽象词，必须先定义它包含哪些事件、状态和交互，再落代码。

描述到实现的完整审查流程见 [`description-to-implementation-audit`](description-to-implementation-audit.md)。

## 编码约束

- reducer 只 spread 变更路径；值未变时返回原引用。禁止 `JSON.parse(JSON.stringify(core))`。
- 嵌套三层以上的状态更新抽 helper，例如 `updatePlayer(core, pid, updater)`。
- 命令数较多或多阶段回合时，从一开始拆 `core-types.ts`、`commands.ts`、`events.ts`，由 `types.ts` re-export。
- core 状态判断：是否被 reducer 写入、是否被 validate / execute / isGameOver 读取并影响决策。等待玩家输入放 sys interaction；纯 UI 展示走 EventStream。
- 两个以上 domain 文件共用的函数放 `domain/utils.ts`；引擎已有能力不得重新实现。

## 分流入口

- 传输、Provider、Board props、乐观命令、本地视角：[`engine-transport`](engine-transport.md)。
- 胜负判定和结束态：[`engine-gameover`](engine-gameover.md)。
- 能力定义、约束、执行器、被动触发：[`engine-ability-framework`](engine-ability-framework.md)。
- 旧 simple-choice 兼容：[`engine-simple-choice`](engine-simple-choice.md)。
- 动画、EventStream、特写、视觉缓冲和实体保留：[`engine-visual-events`](engine-visual-events.md)。
- FX、Shader、FeedbackPack、视觉质量：[`animation-effects`](animation-effects.md)。
- ActionLog、伤害来源和 breakdown：[`engine-action-log`](engine-action-log.md)。
- 伤害计算管线：[`engine-damage-pipeline`](engine-damage-pipeline.md)。
- 具体游戏 runtime 例外、custom action、pending / replacement 白名单：放 `docs/games/<gameId>/` 或对应游戏规则文档，不提升成通用规则。
