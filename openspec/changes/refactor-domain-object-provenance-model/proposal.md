# Change: 重构领域真相边界与对象生命周期建模

## Why

当前领域层对“当前轮到谁决策”“对象是谁、归谁、当前由谁持有/控制、离开当前容器后应回到哪里”“延迟交互应读取 live state 还是快照”“交互语义与 UI 展示模式如何解耦”的表达都不够稳定。部分链路只能依赖活体状态反查、payload 形状猜 UI、或把运行时上下文塞进业务层，暴露出跨游戏的领域真相边界缺口。

这不是某个游戏的局部 bug，而是所有新游戏都会遇到的一组基础设计问题。已暴露的问题至少包含：

- 对象跨区/跨宿主/临时控制时，真实归属与默认终点缺乏独立建模
- afterScoring / deferred 交互在 live state 与 snapshot 之间边界不清
- 当前玩家/当前决策者有统一 hook，但没有统一领域语义与底层宿主
- 交互 UI 通过 payload 里的 `defId/baseDefId/targetType` 猜展示模式，导致语义泄漏到展示层
- 业务层频繁手拼 `playerId/sourcePlayerId/sourceControllerId/ownerId/baseIndex` 等散字段，说明底层 seam 不完整

## What Changes

- 在 `domain-core` 中补充领域真相边界规范：当前决策者、对象稳定身份、归属 provenance、延迟交互快照、自足事件。
- 在 `engine-primitives` 中补充可复用的对象生命周期与交互上下文 primitives，要求用统一的对象引用/快照/value object，而不是业务层手拼散字段或让 UI 猜语义。
- 明确禁止 reducer、interaction、Prompt UI 通过当前容器、当前持有者、来源玩家、payload 形状等易变上下文推断对象语义与展示模式。
- 为后续实现预留统一的 session-context / transfer / attach / detach / control-change / snapshot / interaction descriptor seams，避免每个游戏重复发明协议。

## Impact

- Affected specs: `domain-core`, `engine-primitives`
- Affected code: `src/games/*/domain/**`, `src/games/*/ui/**`, `src/engine/primitives/**`, `src/engine/systems/**`, 所有会产生跨区/跨宿主/控制权变化、延迟交互、payload 驱动 UI 的游戏实现
