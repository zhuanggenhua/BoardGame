---
name: engine-ability-framework
description: 能力框架标准：能力定义、消费点和跨游戏抽象边界——改能力系统时查
metadata:
  type: doc
  status: 已交付
---

# 引擎通用能力框架

## 目标

能力框架负责把“角色、单位、卡牌、状态或规则来源能做什么”建成可验证、可执行、可展示的合同。新游戏涉及可配置技能、卡牌效果、Token 能力、状态能力或等价规则来源时，默认使用 `engine/primitives/ability.ts` 和 `engine/primitives/abilityConstraints.ts`；旧游戏可兼容历史 manager、registry 或 ad-hoc 状态桥，但触碰能力验证、执行、表现或 AI 消费时必须判断是否迁移。

## 核心职责

| 部件 | 职责 | 不允许 |
| --- | --- | --- |
| `AbilityDef` | 描述能力身份、触发、效果、条件、约束、费用、冷却和标签 | 塞入 UI 状态或运行时临时 pending |
| `AbilityRegistry` | 管理能力定义和可测试的注册集合 | 每个游戏自造全局单例或平行注册表 |
| `AbilityExecutorRegistry` | 解析声明式无法覆盖的命令式执行器 | 绕过验证直接写状态 |
| `buildOpportunityFromAbilityDef` / `createAbilityOpportunity` | 把能力在某个规则时点投影为 `Opportunity` 合同 | 执行效果、支付费用、写 state 或替游戏猜同时结算顺序 |
| `createAbilityChoiceContract` | 把能力输入面投影为 `ChoiceRequest` 子合同，并统一 request / candidate provenance | 自行发现合法候选、执行候选命令或替 UI 创建交互 |
| `abilityConstraints` | 统一检查行动消耗、资源、实体状态、使用次数和自定义约束 | 在 `customValidator` 里重复检查通用约束 |
| `primitives/condition` | 承担通用条件表达和求值 | 在游戏层复制条件 DSL |

`getRegisteredIds()` 是实体链完整性测试的合同入口；不能因为当前 UI 用不到就省略注册。

## 执行模式

- **声明式**：能力定义数据进入 registry，由通用效果执行器处理；适合效果结构稳定的能力。
- **命令式**：能力 id / tag 解析到 executor；适合流程差异大、需要复杂领域事务的能力。
- 两种模式可以混用，但同一个能力的最终执行路径必须唯一，不能让声明式和命令式同时抢写同一状态。

## 生命周期投影

有触发、响应、替代、防止、持续、延迟或主动使用窗口的能力，必须先明确能力生命周期阶段，再由 `buildOpportunityFromAbilityDef` 或其别名 `createAbilityOpportunity` 投影成 `Opportunity`：

- `AbilityLifecyclePhase` 表达能力在规则链上的位置：`activation`、`trigger`、`response`、`replacement`、`prevention`、`continuous`、`delayed`。
- `AbilityLifecycleRef` 表达来源对象、控制者、拥有者、变体和当前触发标识；来源可以是卡牌、单位、Token、状态、规则或能力实例。
- 投影结果必须保留能力 ID、来源、控制者、条件、费用、目标请求、结算入口、可见性和 AI 支持；需要玩家或 AI 输入时继续接 `ChoiceRequest` 或 response window。
- 需要玩家或 AI 输入的能力优先用 `createAbilityChoiceContract` 生成 `choice` 子合同；该 helper 会把 ability id、来源对象、控制者、生命周期阶段和变体写入 request / candidate 元数据，并给候选补稳定 `actionKeyParts`，避免 UI、AI、恢复和测试各自重组能力来源。
- `AbilityDef.condition` 由通用条件系统评估；缺少评估上下文或条件不成立时，投影为 inactive opportunity，并交给 `TimingOpportunity` 统一诊断，不在 UI 或 AI 层猜合法性。
- `AbilityDef.cost` 只投影成费用合同，不自动支付；费用扣除、回滚和失败语义仍归游戏正式执行 / 提交流程。
- 投影 helper 不执行 `effects`、不改写 `G.core / G.sys`、不打开交互、不执行候选命令，也不替游戏合成多个同时机会的顺序；这些必须由 `TimingOpportunitySystem`、`EventCommit` 或游戏专属 driver 承载。

## 约束合同

接入能力框架的游戏必须用 `constraints` 字段声明通用约束。约束至少覆盖以下类别：

- 行动消耗：移动、攻击、主要行动或游戏定义的等价资源；
- 实体状态：是否已移动、已攻击、被禁用、横置、耗尽等；
- 资源要求：能量、魔力、生命、充能、手牌或其它可支付资源；
- 使用次数：每回合、每战斗、每阶段或每对象限制；
- 自定义约束：只保留真正游戏专属、无法抽象到通用约束的条件。

自定义约束处理器只能检查自己的专属条件。行动次数、资源、实体状态这类通用条件必须回到通用约束系统，不能散落在每个能力 validator 里。

## 事件和表现

任何会产生玩家可见表现的能力、法术、攻击、移动、治疗、附着、召唤或摧毁，执行结果事件必须携带足够 provenance：来源玩家 / 对象 / 卡牌 / 能力、目标对象 / 区域 / 边、效果实例身份、结果数值、Token / 状态变化和时序身份。

能力系统只负责规则验证、费用、目标合法性、事件和状态结果。动画和视觉延迟通过 EventStream / FX、[`ui-animation-patterns.md`](ui-animation-patterns.md) 和 [`engine-visual-events.md`](engine-visual-events.md) 处理；不得为了等动画而延迟或拆分真实 reducer 结算。

如果某个能力事件无法回答“谁触发、打到哪里、目标发生了什么变化”，事件合同不完整，应先补 provenance，再实现或验收表现。

## 被动触发交互

攻击、移动、结算前后等被动触发能力，必须由规则层输出触发上下文，再由 UI 呈现合法对象、确认和跳过入口。交互入口应贴近真实对象或当前阶段提示；E2E 选择器必须跟随真实 UI，而不是旧弹窗或测试 helper。

## 迁移边界

- 新游戏不得模仿历史 ad-hoc 字段、私有 manager 或散落状态桥。
- 旧游戏迁移时，adapter 只能把旧字段投影到 `AbilityDef`、constraints 或 executor，不能保留第二套能力真相源。
- 旧游戏触碰被动触发、响应、替代、防止或长事务能力时，先把旧能力定义或 handler 投影到 `AbilityDef -> Opportunity` 合同，再决定是否接入 `TimingOpportunitySystem` 或 `EventCommit`。
- 具体游戏试点、迁移进度和剩余缺口不写进本标准；放对应游戏代码、evidence、专项文档或迁移记录。
- 状态 / buff 使用稳定原语表达，例如 tag、modifier、duration 和对象 ref；不得新增散落临时字段集合。
- 对象生命周期和延迟交互必须显式建模，不能靠 payload 形状、当前 pending 字段或 resolve 时回查 handler 推断语义。

## 禁止项

- 禁止游戏层重新实现通用注册表、约束检查或条件 DSL。
- 禁止用可选参数掩盖约束依赖；需要不同输入时拆分函数或声明不同合同。
- 禁止能力执行器绕过 validator、费用支付、目标合法性或 reducer。
- 禁止 UI 文案、按钮顺序或当前选中态成为能力合法性的真相源。
- 禁止把“旧弹窗测试仍通过”当作真实交互已覆盖。
