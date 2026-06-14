## Context
当前仓库已经开始建设跨游戏 AI 骨架与强单机难度体系，但“动作为什么值得做”仍然主要依赖各游戏自行推断。对于复杂回合制桌游，这会导致目标关系和收益方向缺乏统一表达。

## Goals / Non-Goals
- Goals:
  - 定义 AI-only 语义 hints 协议，表达目标亲疏、效果意图、收益/风险与 override。
  - 定义公共 AI 层与游戏适配层的职责边界。
  - 定义交互系统如何保留并传递 AI-only hints。
  - 定义统一的决策 trace 契约。
- Non-Goals:
  - 本 change 不直接规定某个具体游戏的 scorer 权重。
  - 本 change 不直接引入完整 MCTS/深层搜索实现。
  - 本 change 不要求所有旧游戏在同一轮全部迁移完成。

## Decisions
- Decision: AI 语义信息必须与业务 payload 隔离，放入显式 AI-only hints 字段。
  - Why: 避免规则层 handler 把 AI 辅助字段误当成真实业务输入。
- Decision: 公共层负责评分/搜索/预算/tie-break/trace，游戏层只提供合法动作、语义 hints、评估与少量 override。
  - Why: 避免每个游戏重复实现整套框架。
- Decision: 交互系统需要保留 AI-only hints，并在 AI legal action 生成阶段可见。
  - Why: 回合制 AI 的大量错误发生在 interaction-choice，而不只是普通主动作。

## Risks / Trade-offs
- 通用 hints 过粗会丢失游戏语义；过细则会变成另一套业务 DSL。
  - Mitigation: 统一最小必需字段 + 明确 override 口，而不是无限扩字段。
- 老交互入口迁移成本高。
  - Mitigation: 允许分阶段迁移，但必须能显式列出未接入入口。
- trace 太重可能影响性能。
  - Mitigation: 规定统一结构，允许按难度/环境控制详细度。

## Migration Plan
1. 先在公共层定义 hints 与 trace 契约。
2. 让一个复杂游戏先接入（如 SmashUp）。
3. 再把其他游戏逐步迁移到同一适配边界。

## Open Questions
- `AiHint` 是否需要细分基础字段与游戏自定义扩展字段。
- interaction option 的 hints 是否统一挂在 `_ai`，还是引擎层另建专用字段名。
