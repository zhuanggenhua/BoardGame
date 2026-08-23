# YGOPro 时点响应模型吸收对照

日期：2026-08-21
角色：外部架构吸收记录，不是项目规范正文。现行规则入口看 [时点-机会-结算标准](../../.spec/knowledge/standards/timing-opportunity-resolution.md)。

## 结论

`Fluorohydride/ygopro` 的价值不是前端、后端服务、素材或 GPL 脚本，而是裁判模型：规则核心推进到时点，发现可触发 / 响应 / 替代 / 防止的机会，必要时暂停等待玩家或 AI 输入，再回到同一条结算链。

本项目应吸收这个抽象，不吸收代码和 IP 内容。

## 可吸收能力

| 层级 | 能力 | 接入口径 |
| --- | --- | --- |
| P0 | 时点 / 机会 / 响应模型 | 有触发、响应、替代、防止、长事务或 AI 阻塞时接入 |
| P0 | 效果生命周期 | 有技能、卡牌效果、状态、来源、费用、目标或次数限制时接入 |
| P0 | 事件改写 / 替代 / 防止 | 有取消、缩小、重定向、减伤、护盾、复活或替代支付时接入 |
| P0 | 结算栈 / 长事务 driver | 有多步结算、连锁响应、战斗窗口、清场后续或跨事件批流程时接入 |
| P0 | 合法动作查询 / 裁判消息 | UI、AI、服务端验证需要消费同一份选择合同时接入 |
| P1 | 静态资料 / 运行时状态 / 脚本分离 | 配置型游戏、卡牌游戏和可扩展内容包默认采用 |
| P1 | 可查询裁判状态 | 有 playerView、AI legal-action、提示高亮、回放审计时接入 |
| P1 | 确定性回放 / 测试模型 | 复杂规则、线上对局、AI 决策和 bug 复盘优先接入 |
| P2 | 牌组 / 初始配置导入导出 | 有卡组、剧本、地图包、角色包或用户配置分享时接入 |
| P2 | 脚本沙箱与注册机制 | 只吸收“受控接口注册效果”的思想，不直接引入 Lua/GPL 脚本 |

## 不吸收

- 不复制原生 UI、Irrlicht 渲染、快捷键和窗口逻辑。
- 不复制官方卡图、声音、贴图、脚本或游戏 IP 内容。
- 不把 GPL-2.0 主仓库并入本项目源码。
- 不把单游戏规则常量照搬成平台层常量。
- 不把“所有效果都是 LIFO 栈”当成通用桌游结论。

## 抽象对照

| 参考点 | YGOPro 做法 | 本项目应吸收的抽象 |
| --- | --- | --- |
| 规则核心 | `process()` 推进状态，`get_message()` 输出待处理消息，`set_response*()` 接收选择 | 引擎推进到阻塞点，输出 `ChoiceRequest` / response window，收到响应后恢复同一 frame |
| 数据分离 | 资料、脚本、牌组、UI 目录分离 | 游戏配置、规则能力、选择合同、素材和运行时状态分离 |
| 效果注册 | 脚本注册条件、目标、执行 | 能力定义拆出时点、条件、费用、目标、执行、AI 支持和可见性 |
| 牌组文件 | 文本分段保存初始配置 | setup 数据可导入导出，不混运行时状态 |
| 卡牌数据库 | 静态资料和文案分表 | 静态资料只提供事实属性、文案和索引，不承载结算状态 |

## 项目现状

已有底座：

- `ChoiceRequest` 可表达玩家 / AI 选择合同。
- `ResolutionFrame / ResolutionState` 可表达连续结算帧骨架。
- `ResponseWindowSystem` 可承载响应者队列与让过。
- `playerView`、传输层和 AI 决策视图已有隐私过滤和合法动作承载。

主要缺口：

| 缺口 | 现实后果 |
| --- | --- |
| 统一 `TimingPoint` 不完整 | 触发、响应、替代、防止缺少稳定规则断点 |
| 统一 `Opportunity` 不完整 | 谁能响应、谁必须触发、谁能替代原事件无法结构化枚举 |
| `ResolutionFrame` 仍缺完整 handler | 多步推进、deferred action 和 handoff 仍需按机制逐步接 owner |
| 旧私有续链仍存在 | `pending*`、`continuationContext`、私有 queue / stack 会继续抢权 |
| UI / AI 易重复猜合法动作 | 玩家按钮、AI legal-actions、服务端 validate 可能出现相似但不等价条件 |

## 平台模型

```text
Domain Event / Command
  -> TimingPoint
  -> OpportunityDiscovery
  -> Opportunity
  -> ChoiceRequest / ResponseWindow
  -> ResolutionFrame
  -> EventCommit
```

关键边界：

- `TimingPoint` 是规则事实断点，不是 UI 步骤名。
- `Opportunity` 是合法机会真相源，不是按钮列表。
- `ChoiceRequest` 是选择合同，不是弹窗实现。
- `ResponseWindowSystem` 是响应承载层，不负责自己发现所有响应内容。
- `ResolutionFrame` 是连续结算事务权威，不能被私有续链抢主权威。
- `EventCommit` 前处理替代 / 防止，事件正式落地后再产生事实触发。

## 当前实现入口

| 入口 | 状态 |
| --- | --- |
| `src/engine/TimingOpportunity.ts` | 已提供 `TimingPoint`、`Opportunity`、发现 runner、校验和投影 helper |
| `src/engine/primitives/ability.ts` | 已补能力生命周期和能力到 Opportunity 的构造入口 |
| `DomainCore.discoverTimingOpportunities` | 可选发现入口；未实现时返回空机会 |
| `DomainCore.commitEvent` | 事件正式归约前的可选提交入口 |
| `commitEventWithTimingOpportunities` | 最小 EventCommit driver |
| `EventCommitEvidence` / `PipelineResult.eventCommitEvidence` | 裁判证据出口 |
| `src/engine/systems/RefereeTraceSystem.ts` | 把 EventCommit evidence 写入 `G.sys.refereeTrace` |
| `src/engine/RefereeView.ts` | 只读裁判消息 / 决策面摘要 |
| `src/engine/RefereeReplay.ts` | 裁判证据回放摘要，不是完整 replay 执行器 |
| `src/engine/systems/ResolutionFrameSystem.ts` | 最小可选长事务 driver |
| `src/engine/systems/TimingOpportunitySystem.ts` | 可选系统，负责把 opportunity 投影到现有交互或 frame |

这些入口都是 opt-in；`createBaseSystems` 不默认加入 TimingOpportunitySystem / ResolutionFrameSystem。

## 迁移试点记录

具体游戏试点状态不写在本平台吸收文档里；已迁到对应游戏记录：[`../games/mage-wars/records/timing-opportunity-migration-pilot-2026-08-21.md`](../games/mage-wars/records/timing-opportunity-migration-pilot-2026-08-21.md)。

## 接入要求

新游戏或旧游戏改造只有命中以下任一需求时，才接入时点-机会-结算模型：

- 触发、被动、持续、回合开始 / 结束效果。
- 响应、打断、反制、取消、改写。
- 替代、防止、减伤、护盾、复活、重定向。
- 多步选择、可选效果、任意数量、隐藏信息 prompt。
- 战斗、伤害、计分、清场、回合外行动、额外行动。
- AI 座位可能参与的阻塞交互。

最低产物：

- `TimingPoint / Opportunity` 矩阵。
- 每个机会的来源、控制者、触发条件、费用、目标请求、执行器、可见性和 AI 支持。
- 每个机会能追到同一个 `ChoiceRequest` / response window、服务端验证、UI 展示、AI legal-action 和 resolution frame。

## 兼容策略

- 未触碰的旧 `pending* / continuationContext / simple-choice / 私有 session` 可保留。
- 修改旧窗口的触发、响应、替代、防止、长事务、AI 卡点或线上恢复时，必须判断是否迁到 `TimingPoint / Opportunity / ResolutionFrame`。
- 迁移时允许薄 adapter，但必须写清代理哪个旧入口、由哪个新 frame / opportunity 接管、删除条件是什么。
- 试点细节写入对应游戏记录或 evidence，不写进本平台吸收文档。

## 资料来源

- `Fluorohydride/ygopro` 主仓库 README、目录和子模块：`https://github.com/Fluorohydride/ygopro`
- `ygopro-core` API 与 README：`https://github.com/Fluorohydride/ygopro-core`
- `ygopro-scripts` Lua 示例：`https://github.com/Fluorohydride/ygopro-scripts`
- 本项目源码：`src/engine/TimingOpportunity.ts`、`src/engine/ChoiceRequest.ts`、`src/engine/systems/ResolutionFrameSystem.ts`、`src/engine/systems/ResponseWindowSystem.ts`
