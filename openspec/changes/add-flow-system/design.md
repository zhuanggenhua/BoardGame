## Context
项目 AGENTS.md 明确要求"数据驱动优先"和"框架解耦"。当前 DiceThrone 的阶段状态机（TurnPhase + PHASE_ORDER + getNextPhase）是游戏层实现，无法被 UGC 游戏复用。引擎层 `SystemState.phase` 已预留但未使用。

## Goals / Non-Goals
**Goals:**
- 引擎层提供通用的阶段流程管理能力
- `sys.phase` 成为单一权威相位来源
- 游戏层通过 hook 自定义阶段逻辑
- 支持 UGC 游戏定义自己的阶段流程

**Non-Goals:**
- 不做阶段跳转的配置化（保持 hook 灵活性）
- 不改变现有 boardgame.io 集成方式
- 不影响非阶段制游戏（如 TicTacToe）

## Decisions

### Decision 1: FlowSystem 只负责执行和事件分发
FlowSystem 不内置任何阶段逻辑，完全依赖游戏层 hook：
- `canAdvance(state, from)` → 是否允许推进
- `getNextPhase(state, from)` → 下一阶段 ID
- `onPhaseEnter(state, phase)` → 进入阶段时的事件
- `onPhaseExit(state, phase)` → 离开阶段时的事件

**Rationale:** 条件跳转配置化不够灵活，UGC 游戏的阶段逻辑可能非常复杂。

### Decision 2: sys.phase 为单一权威
移除 `core.turnPhase`，所有代码统一读写 `sys.phase`。

**Alternatives considered:**
- 保留 `core.turnPhase` 作为只读镜像 → 增加同步开销和一致性风险
- 双源并存 → 违反单一权威原则

### Decision 3: FlowHooks 通过 AdapterConfig 注入
游戏在 `createGameAdapter` 时传入 `flowHooks`，FlowSystem 在执行时调用。

```typescript
interface FlowHooks<TCore> {
  initialPhase: string;
  canAdvance?(state: TCore, from: string): boolean;
  getNextPhase(state: TCore, from: string): string;
  onPhaseEnter?(state: TCore, phase: string): GameEvent[];
  onPhaseExit?(state: TCore, phase: string): GameEvent[];
}
```

### Decision 4: ADVANCE_PHASE 统一由 FlowSystem 处理
游戏层不再在 `execute.ts` 中处理 `ADVANCE_PHASE`，改为：
1. FlowSystem.beforeCommand 拦截 ADVANCE_PHASE
2. 调用 `canAdvance` hook 校验
3. 调用 `onPhaseExit` hook 获取事件
4. 调用 `getNextPhase` hook 获取下一阶段
5. 更新 `sys.phase`
6. 调用 `onPhaseEnter` hook 获取事件
7. 返回所有事件供 domain.reduce 处理

## Risks / Trade-offs
- **迁移成本**：DiceThrone 有 ~30 处 `turnPhase` 引用需要改为 `sys.phase`
- **测试覆盖**：flow.test.ts 需要全面更新
- **向后兼容**：无，这是架构改进

## Migration Plan
1. 引擎层实现 FlowSystem（不影响现有游戏）
2. DiceThrone 实现 FlowHooks
3. 迁移 `core.turnPhase` → `sys.phase`（批量替换）
4. 更新 UI 组件读取 `sys.phase`
5. 删除 `core.turnPhase` 字段
6. 更新测试

## Open Questions
- 无
