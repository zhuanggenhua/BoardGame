## Context

当前项目的领域对象在不同区域/宿主/载体中往往有多种运行时表示：手牌/牌库中的 `CardInstance`、场上的随从/持续牌/附着牌、埋葬对象、泰坦、未来新游戏中的单位/装备/状态载体等。

同时，当前“谁在当前窗口有权决策”“交互在延迟窗口里该读取 live state 还是创建时快照”“UI 是按钮模式还是卡牌模式”这些事实，也没有稳定地放在统一 contract 上。

一旦对象发生以下变化，现有模型就容易丢失事实：

- 从一个区域转到另一个区域
- 从一个宿主脱离，再挂到另一个宿主
- 临时由别的玩家持有、控制或代为结算
- 离开当前活体容器后，仍需要按原始归属结算默认终点
- 在来源对象已不可见时，仍需要重建对象并继续归约
- 在交互创建和交互解决之间，live state 已被其他事件改写
- payload 里混入 `defId/baseDefId/targetType` 后被 UI 误判成另一种交互展示模式
- 不同游戏用 `currentPlayer/currentPlayerId/currentPlayerIndex` 表达相同概念

当前风险不是“少一个字段”，而是“领域事实没有被建模成一等公民，真相边界在状态 / 事件 / 交互 / UI 之间漂移”。

## Goals / Non-Goals

- Goals:
  - 为跨游戏“当前决策者 / 当前活跃玩家”提供统一领域语义与查询边界
  - 为跨游戏领域对象提供稳定身份与 provenance 建模原则
  - 为 deferred interaction 提供清晰的 snapshot vs live-state 边界
  - 为交互语义与 UI 展示提供解耦 contract
  - 让跨区/跨宿主事件成为自足事实，不再依赖易变活体上下文反查
  - 让业务层调用统一 seam，而不是各游戏手拼零散字段
- Non-Goals:
  - 本 proposal 不直接定义某个游戏的专有规则
  - 本 proposal 不要求一次性重写所有历史对象模型

## Decisions

- Decision: 统一区分 session context、entity lifecycle、interaction snapshot、presentation descriptor 四类事实
  - session context 负责“当前谁有权决策/谁是当前活跃玩家”
  - entity lifecycle 负责“对象是谁/归谁/当前由谁控制/默认终点”
  - interaction snapshot 负责“延迟交互解决时必须保持的创建时事实”
  - presentation descriptor 负责“这个交互应该如何展示”，不得再从业务 payload 猜

- Decision: 领域对象采用“稳定实体身份 + 不可变 provenance value object + 容器/宿主投影”的设计
  - `uid` 代表对象稳定身份
  - `owner/controller/holder/host/defaultDestination` 等跨时序事实不能再隐含在当前容器里
  - 不同区域中的运行时结构可以不同，但它们必须都能回到同一套稳定身份与 provenance 语义

- Decision: 当前玩家/当前决策者需要统一查询协议和统一语义名词
  - 游戏可以保留不同的内部表示
  - 但引擎与共享层消费的语义必须统一，例如 `currentActor/currentDecisionOwner/currentTurnPlayer`
  - 共享层不得继续把 `currentPlayer/currentPlayerId/currentPlayerIndex` 当作可互换的弱约定

- Decision: 跨边界事件必须是自足事实，而不是“提示 reducer 自己去猜”
  - transfer / attach / detach / control-change / recover / box / remove 这类事件，必须能在来源对象不可见时仍被正确 replay/reduce
  - reducer 可以优先使用 live object，但不能把 live object lookup 当作唯一真相源

- Decision: deferred interaction 必须显式声明哪些事实是 snapshot，哪些事实允许 live lookup
  - 任何跨阶段、跨清场、跨宿主变化仍要使用的对象事实，必须在交互创建时快照
  - 只有明确声明为“解决时按 live state 重新计算”的字段，才允许在 handler 里现查

- Decision: 交互语义与 UI 展示模式必须解耦
  - 交互的业务语义不再通过 `defId/baseDefId/targetType` 等 payload 形状隐式推断展示模式
  - 共享 UI 必须消费独立的 interaction descriptor / display descriptor
  - 业务上下文允许携带对象 ref，但这不自动等于“卡牌模式 / 基地模式 / 按钮模式”

- Decision: 统一提供对象生命周期 domain service / primitives
  - 统一的 `ObjectRef` / `ObjectSnapshot` / `ProvenanceSnapshot` 或等价 value object
  - 统一的 `reifyObjectFromRef()` / `transferObject()` / `detachObject()` / `resolveDefaultDestination()` 或等价 seams
  - 业务层不再直接构造“几个 id + reason”的弱事件模型

- Decision: 明确禁止从易变上下文推断领域事实
  - `fromPlayerId` 不等于真实拥有者
  - 当前容器不等于默认终点
  - 当前控制者/持有者/宿主不等于对象真实归属
  - 这些只能作为运行时上下文，不能充当 provenance 真相源

## Risks / Trade-offs

- 风险：一次性替换所有历史事件模型与交互 descriptor 成本高
  - Mitigation：先补统一 seam，再按高风险事件 family 分批迁移

- 风险：不同游戏对象形态差异大，抽象过头会变成空壳
  - Mitigation：只抽“稳定身份 + provenance + reify seam”这一层；游戏专属规则仍留在各自 domain

## Migration Plan

1. 在 spec 层明确真相边界原则与门禁
2. 设计统一的 session context / object ref / provenance / interaction descriptor primitives
3. 先迁移最容易丢失 provenance 或最依赖 live state 的高风险 family
4. 按游戏/事件 family / interaction family 分批收口，而不是一次性全仓硬切

当前 rollout inventory 与批次划分见同目录 [rollout.md](./rollout.md)。

## Open Questions

- `ObjectRef` 与 `ObjectSnapshot` 的边界如何划分，何时只传引用，何时必须传快照？
- `InteractionDescriptor` 应收敛到 primitives 还是 systems 层？
- 哪些对象 family 可以共用同一套 primitives，哪些需要游戏层附加字段？
