# Change: 重构领域对象身份与 provenance 建模

## Why

当前领域层对“对象是谁、归谁、当前由谁持有/控制、离开当前容器后应回到哪里”的表达不够完整。部分跨区/跨宿主/临时控制链路只能依赖活体状态反查，导致业务层被迫补零散字段，暴露出跨游戏的对象建模缺口。

这不是某个游戏的局部 bug，而是所有新游戏都会遇到的领域对象设计问题：一旦对象会跨区、附着、脱离、代持、代打、临时控制或宿主切换，现有“几个散字段 + 运行时反查”的模式就会丢失 provenance，并把底层细节泄漏到游戏能力实现里。

## What Changes

- 在 `domain-core` 中补充跨边界对象必须保持稳定身份与 provenance 的规范。
- 在 `engine-primitives` 中补充可复用的对象生命周期 primitives 方向，要求用统一的对象引用/快照/value object，而不是业务层手拼散字段。
- 明确禁止 reducer 通过当前容器、当前持有者、来源玩家等易变上下文推断对象的真实归属与默认终点。
- 为后续实现预留统一的 transfer / attach / detach / control-change / reify seams，避免每个游戏重复发明一套对象迁移协议。

## Impact

- Affected specs: `domain-core`, `engine-primitives`
- Affected code: `src/games/*/domain/**`, `src/engine/primitives/**`, 所有会产生跨区/跨宿主/控制权变化事件的游戏实现
