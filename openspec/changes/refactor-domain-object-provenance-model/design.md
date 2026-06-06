## Context

当前项目的领域对象在不同区域/宿主/载体中往往有多种运行时表示：手牌/牌库中的 `CardInstance`、场上的随从/持续牌/附着牌、埋葬对象、泰坦、未来新游戏中的单位/装备/状态载体等。

一旦对象发生以下变化，现有模型就容易丢失事实：

- 从一个区域转到另一个区域
- 从一个宿主脱离，再挂到另一个宿主
- 临时由别的玩家持有、控制或代为结算
- 离开当前活体容器后，仍需要按原始归属结算默认终点
- 在来源对象已不可见时，仍需要重建对象并继续归约

当前风险不是“少一个字段”，而是“领域事实没有被建模成一等公民”。

## Goals / Non-Goals

- Goals:
  - 为跨游戏领域对象提供稳定身份与 provenance 建模原则
  - 让跨区/跨宿主事件成为自足事实，不再依赖易变活体上下文反查
  - 让业务层调用统一 seam，而不是各游戏手拼零散字段
- Non-Goals:
  - 本 proposal 不直接定义某个游戏的专有规则
  - 本 proposal 不要求一次性重写所有历史对象模型

## Decisions

- Decision: 领域对象采用“稳定实体身份 + 不可变 provenance value object + 容器/宿主投影”的设计
  - `uid` 代表对象稳定身份
  - `owner/controller/holder/host/defaultDestination` 等跨时序事实不能再隐含在当前容器里
  - 不同区域中的运行时结构可以不同，但它们必须都能回到同一套稳定身份与 provenance 语义

- Decision: 跨边界事件必须是自足事实，而不是“提示 reducer 自己去猜”
  - transfer / attach / detach / control-change / recover / box / remove 这类事件，必须能在来源对象不可见时仍被正确 replay/reduce
  - reducer 可以优先使用 live object，但不能把 live object lookup 当作唯一真相源

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

- 风险：一次性替换所有历史事件模型成本高
  - Mitigation：先补统一 seam，再按高风险事件 family 分批迁移

- 风险：不同游戏对象形态差异大，抽象过头会变成空壳
  - Mitigation：只抽“稳定身份 + provenance + reify seam”这一层；游戏专属规则仍留在各自 domain

## Migration Plan

1. 在 spec 层明确原则与门禁
2. 设计通用的对象引用 / provenance primitives
3. 先迁移最容易丢失 provenance 的跨区事件 family
4. 按游戏/事件 family 分批收口，而不是一次性全仓硬切

## Open Questions

- `ObjectRef` 与 `ObjectSnapshot` 的边界如何划分，何时只传引用，何时必须传快照？
- 哪些对象 family 可以共用同一套 primitives，哪些需要游戏层附加字段？
