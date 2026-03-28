## Context
仓库现状已经从“尝试在 systems 层统一领域概念”演进为“两层并存”：

- `src/engine/systems/` 保留并继续承载 Flow / Interaction / Undo / ResponseWindow / ActionLog 等运行时系统
- `src/engine/primitives/` 新增并承载跨游戏复用的纯函数工具、容器和注册器

这次收口的目标不是再推动一次大重构，而是把 spec 口径修正为已经落地的事实。

## Goals / Non-Goals
- Goals:
  - 用正式 spec 固化 primitives 层的真实职责与边界
  - 明确骰子能力已经迁移为显式定义 + 纯函数 API
  - 纠正“systems 层已删除”这类已失真的旧表述
- Non-Goals:
  - 不要求删除现有 `src/engine/systems/`
  - 不要求所有游戏在同一轮里迁移到完全一致的 primitives 组合
  - 不把后续 AI、UGC、交互框架等其他 change 混入本次归档

## Decisions

### 1. 保留 systems 层，新增 primitives 层
- Decision: 正式口径改为“systems 与 primitives 并存”
- Rationale:
  - `systems/` 处理对局生命周期、事件后处理、交互编排、撤回等运行时职责
  - `primitives/` 处理跨游戏通用的纯函数与注册器，不承载整局运行时 orchestration

### 2. 复用底层原语，不复用具体领域语义
- Decision: primitives 只定义可复用的计算、容器、注册器和 helper，不预定义某个游戏的具体技能/伤害/召唤语义
- Rationale:
  - 不同游戏在触发时机、目标模型、执行上下文上差异很大
  - 可复用的是表达式、条件、tag、modifier、attribute、dice、zone、资源等底层原语

### 3. 注册器按游戏实例化，不采用全局单例
- Decision: condition / target / effects / action / ability 等采用“每个游戏自己创建 registry”的模式
- Rationale:
  - 避免跨游戏污染
  - 便于测试
  - 符合当前 `create*Registry()` / `new *Registry()` 的真实实现

### 4. 骰子能力以显式定义 + 纯函数 API 为准
- Decision: `dice-system` 正式口径改为由游戏层导出 `DiceDefinition` 常量，并通过 `createDie` / `rollDie` / `rollDice` / `calculateDiceStats` 等函数消费
- Rationale:
  - 当前实现已经不依赖全局 definition registry
  - DiceThrone 英雄骰子配置已经按此模式落地

## Risks / Trade-offs
- Risk: 旧 proposal 中“删 systems 层”的表述已经与代码现实冲突
  - Mitigation: 在 proposal/design/spec delta 里显式收缩 scope，避免错误归档
- Risk: primitives 模块会继续扩展，精确枚举文件数量容易过时
  - Mitigation: spec 固化职责和代表性能力，不把未来新增模块数量写死

## Migration Plan
1. 以当前仓库为准重写 change 文档
2. 用 `engine-primitives` 新 capability 固化 primitives 层
3. 更新 `dice-system` 正式 spec 到纯函数口径
4. 通过 `openspec validate`
5. 归档 `refactor-engine-primitives`

## Open Questions
- 无。当前 change 已经属于“实现完成，spec 口径落后”的收口工作。
