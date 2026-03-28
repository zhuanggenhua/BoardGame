## Context
项目已经存在统一交互状态机 `sys.interaction.current / queue`，但早期模型更偏向“一问一答”。DiceThrone 的骰子交互需要用户先在客户端局部调整，再统一确认提交，因此最终落地为新增 `multistep-choice`，而不是继续堆叠游戏私有 kind。

## Goals / Non-Goals
- Goals:
  - 在引擎层正式定义“多步本地预览 -> 一次确认”的交互模型
  - 让 DiceThrone 骰子交互改用统一模型
  - 保留现有 `simple-choice` / `slider-choice` 和非骰子私有交互的兼容性
- Non-Goals:
  - 不把所有游戏私有交互都强行迁移到 `multistep-choice`
  - 不改变网络协议为“每一步都发服务端”
  - 不删除 DiceThrone 状态选择类仍在使用的 `dt:card-interaction`

## Decisions

### 1. 中间步骤纯客户端执行
- Decision: `multistep-choice` 的中间步骤通过 `localReducer` 在客户端本地累计结果，不经过 pipeline
- Rationale:
  - 骰子修改、选骰这类操作在确认前不需要污染权威状态
  - 可以避免每次 `+/-` 都发一条业务命令

### 2. 确认时转为现有业务命令
- Decision: 确认时通过 `toCommands(result)` 生成现有业务命令列表，再依次 `dispatch`
- Rationale:
  - 复用现有 `MODIFY_DIE` / `REROLL_DIE` 等命令
  - 避免为中间 UI 过程新增大量服务端专用命令

### 3. UI Hook 负责本地状态，系统负责确认事件
- Decision:
  - `useMultistepInteraction` 负责本地 `result` / `stepCount` / `confirm` / `cancel`
  - `MultistepChoiceSystem` 负责处理 `SYS_INTERACTION_CONFIRM` 并发出 `SYS_INTERACTION_CONFIRMED`
- Rationale:
  - 将“本地预览”与“引擎交互状态流转”分层
  - 保持与现有 `InteractionSystem` 架构一致

### 4. 序列化边界由 meta + 客户端补水解决
- Decision: `localReducer` / `toCommands` 这类函数不直接依赖序列化持久化结果，必要时通过 `meta` 和客户端补水恢复
- Rationale:
  - interaction 数据经过 JSON 序列化后函数会丢失
  - 当前 DiceThrone 已在 `RightSidebar.tsx` 和测试工具中按该模式补水

### 5. 非 React 场景保留引擎侧补偿
- Decision: 对无 React Hook 参与的测试/纯引擎场景，由游戏侧 afterEvents 逻辑补足 `maxSteps` 自动完成语义
- Rationale:
  - `useMultistepInteraction` 只覆盖真实 UI 路径
  - 现有测试与纯引擎运行路径仍需可用

## Risks / Trade-offs
- Risk: `multistep-choice` 含函数型字段，天然不适合直接跨序列化边界传输
  - Mitigation: 用 `meta` 传输足够的重建信息，在客户端和测试工具中补水
- Risk: UI auto-confirm 与引擎侧补偿若不一致，容易重复确认
  - Mitigation: Hook 使用 `confirmedRef` 去重，系统侧按当前 interaction 状态兜底

## Migration Plan
1. 在 `InteractionSystem` 中定义 `MultistepChoiceData`、工厂函数与扁平化 helper
2. 增加 `MultistepChoiceSystem` 与 `useMultistepInteraction`
3. 将 DiceThrone 骰子修改 / 选骰交互迁移到 `multistep-choice`
4. 保留状态选择类 `dt:card-interaction`
5. 补齐 Hook / DiceThrone / 交互锁相关测试
