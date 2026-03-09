# Bugfix Requirements Document

## Introduction

修复 Cardia 游戏中 FlowSystem 阶段同步 bug。在移除临时 PHASE_CHANGED 事件发射后，`sys.phase` 和 `core.phase` 出现不同步，导致能力激活验证失败。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN FlowSystem 推进阶段并发射 SYS_PHASE_CHANGED 事件 THEN `sys.phase` 被更新但 `core.phase` 保持旧值

1.2 WHEN `validateActivateAbility` 检查阶段时 THEN 读取 `core.phase` 而非 `sys.phase`，导致"Not in ability phase"错误

1.3 WHEN reducer 处理事件时 THEN 只有 `CARDIA_EVENTS.PHASE_CHANGED` 的 case，没有处理 `SYS_PHASE_CHANGED` 系统事件

### Expected Behavior (Correct)

2.1 WHEN FlowSystem 发射 SYS_PHASE_CHANGED 事件 THEN reducer SHALL 同步更新 `core.phase` 以匹配 `sys.phase`

2.2 WHEN `validateActivateAbility` 检查阶段时 THEN SHALL 读取 `sys.phase`（FlowSystem 管理的权威来源）而非 `core.phase`

2.3 WHEN reducer 处理 SYS_PHASE_CHANGED 事件时 THEN SHALL 更新 `core.phase` 字段以保持同步

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 游戏逻辑需要读取当前阶段时 THEN SHALL CONTINUE TO 从 `sys.phase` 读取（已在 flowHooks.ts 中正确实现）

3.2 WHEN 其他验证函数检查阶段时 THEN SHALL CONTINUE TO 使用 `sys.phase` 或 `state` 参数（如 `validateSkipAbility` 已正确实现）

3.3 WHEN FlowSystem 自动推进阶段时 THEN SHALL CONTINUE TO 正常工作（`onAutoContinueCheck` 已基于 DiceThrone 最佳实践修复）

3.4 WHEN 回合结束事件触发时 THEN SHALL CONTINUE TO 正确推进到下一回合的 play 阶段

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type { state: MatchState<CardiaCore>, command: CardiaCommand }
  OUTPUT: boolean
  
  // 当 FlowSystem 推进阶段后，sys.phase 和 core.phase 不一致
  RETURN X.state.sys.phase !== X.state.core.phase
END FUNCTION
```

### Property Specification - Fix Checking

```pascal
// Property: Fix Checking - Phase Synchronization
FOR ALL X WHERE isBugCondition(X) DO
  // 修复后，sys.phase 和 core.phase 应该始终一致
  result ← executePipeline'(X.state, X.command)
  ASSERT result.state.sys.phase = result.state.core.phase
END FOR
```

### Property Specification - Preservation Checking

```pascal
// Property: Preservation Checking - Validation Logic
FOR ALL X WHERE NOT isBugCondition(X) DO
  // 对于已同步的状态，修复不应改变验证行为
  ASSERT validate(X.state, X.command) = validate'(X.state, X.command)
END FOR
```

## Root Cause Analysis

**根本原因**：`reduce.ts` 中的 switch 语句只处理领域事件 `CARDIA_EVENTS.PHASE_CHANGED`，没有处理 FlowSystem 发射的系统事件 `SYS_PHASE_CHANGED`（即 `FLOW_EVENTS.PHASE_CHANGED`）。

**时序分析**：
1. FlowSystem.afterEvents 检测到自动推进条件
2. FlowSystem 调用 `dispatch(ADVANCE_PHASE)` 命令
3. FlowSystem 发射 `SYS_PHASE_CHANGED` 事件并更新 `sys.phase`
4. Pipeline 调用 `reduceEventsToCore`，但 reducer 没有处理 `SYS_PHASE_CHANGED`
5. 结果：`sys.phase` 已更新，`core.phase` 保持旧值

**架构问题**：
- `validateActivateAbility` 读取 `core.phase` 而非 `sys.phase`（权威来源）
- `reduce.ts` 缺少 `SYS_PHASE_CHANGED` 事件处理器
- 临时修复方案（手动发射 PHASE_CHANGED）绕过了 FlowSystem 的设计

## Solution Approach

基于 DiceThrone 的最佳实践（参考 `reports/flow-system-investigation.md`），采用以下修复方案：

1. **在 reduce.ts 中添加 SYS_PHASE_CHANGED 处理器**：同步更新 `core.phase`
2. **修改 validateActivateAbility**：从 `state.sys.phase` 读取阶段而非 `core.phase`
3. **保留 PHASE_CHANGED 处理器**：向后兼容（如果有其他代码仍发射领域事件）

**不采用的方案**：
- ❌ 在 core 中添加 `shouldAdvancePhase` 标志（增加状态复杂度）
- ❌ 保持临时修复方案（违反 FlowSystem 设计原则）
- ❌ 移除 `core.phase` 字段（可能破坏其他依赖）

## Files Involved

- `src/games/cardia/domain/reduce.ts` - 添加 SYS_PHASE_CHANGED 处理器
- `src/games/cardia/domain/validate.ts` - 修改 `validateActivateAbility` 读取 `sys.phase`
- `src/games/cardia/domain/flowHooks.ts` - 已修复（参考）
- `src/engine/systems/FlowSystem.ts` - 参考 SYS_PHASE_CHANGED 事件结构

## Testing Strategy

### Unit Tests

1. **Phase Synchronization Test**：验证 SYS_PHASE_CHANGED 事件后 `sys.phase === core.phase`
2. **Validation Test**：验证 `validateActivateAbility` 在 ability 阶段返回 `{ valid: true }`
3. **Auto-Advance Test**：验证 FlowSystem 自动推进后阶段同步

### Integration Tests

1. **Complete Turn Flow**：验证 play → ability → end → play 完整流程
2. **Ability Activation**：验证能力激活交互正常弹出
3. **Turn End**：验证回合结束后正确推进到下一回合

### Regression Tests

1. **Other Validations**：验证其他验证函数（`validateSkipAbility` 等）不受影响
2. **FlowHooks**：验证 `onAutoContinueCheck` 仍正常工作
3. **Event Handling**：验证其他事件处理器不受影响
