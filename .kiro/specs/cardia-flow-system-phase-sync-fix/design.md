# Cardia FlowSystem 阶段同步修复 - 设计文档

## Overview

修复 Cardia 游戏中 FlowSystem 阶段同步 bug。当 FlowSystem 推进阶段时，`sys.phase` 被更新但 `core.phase` 保持旧值，导致能力激活验证失败。本设计采用 DiceThrone 的最佳实践，通过在 reducer 中处理 `SYS_PHASE_CHANGED` 事件来同步 `core.phase`，并修改验证层从 `sys.phase` 读取权威阶段值。

## Glossary

- **Bug_Condition (C)**: FlowSystem 推进阶段后 `sys.phase` 和 `core.phase` 不一致的条件
- **Property (P)**: 修复后两个阶段字段应始终保持同步
- **Preservation**: 其他验证函数和 FlowHooks 的行为不受影响
- **SYS_PHASE_CHANGED**: FlowSystem 发射的系统事件（`FLOW_EVENTS.PHASE_CHANGED`），包含 `{ from, to, activePlayerId }` payload
- **sys.phase**: FlowSystem 管理的权威阶段字段（位于 `state.sys.phase`）
- **core.phase**: 游戏核心状态中的阶段字段（位于 `state.core.phase`），需要与 `sys.phase` 保持同步
- **reducePhaseChanged**: 现有的阶段变更 reducer 函数，处理 `CARDIA_EVENTS.PHASE_CHANGED` 领域事件

## Bug Details

### Fault Condition

Bug 在以下情况下触发：FlowSystem 检测到自动推进条件并调用 `dispatch(ADVANCE_PHASE)`，FlowSystem 发射 `SYS_PHASE_CHANGED` 事件并更新 `sys.phase`，但 reducer 没有处理该事件，导致 `core.phase` 保持旧值。

**Formal Specification:**
```
FUNCTION isBugCondition(state)
  INPUT: state of type MatchState<CardiaCore>
  OUTPUT: boolean
  
  RETURN state.sys.phase !== state.core.phase
         AND state.sys.phase IN ['play', 'ability', 'end']
         AND state.core.phase IN ['play', 'ability', 'end']
END FUNCTION
```

### Examples

- **Example 1**: FlowSystem 从 'play' 推进到 'ability' 阶段
  - 预期：`sys.phase = 'ability'` AND `core.phase = 'ability'`
  - 实际：`sys.phase = 'ability'` BUT `core.phase = 'play'`
  - 结果：`validateActivateAbility` 读取 `core.phase = 'play'` 返回 "Not in ability phase" 错误

- **Example 2**: FlowSystem 从 'ability' 推进到 'end' 阶段
  - 预期：`sys.phase = 'end'` AND `core.phase = 'end'`
  - 实际：`sys.phase = 'end'` BUT `core.phase = 'ability'`
  - 结果：`validateEndTurn` 读取 `core.phase = 'ability'` 返回 "Not in end phase" 错误

- **Example 3**: 手动调用 `dispatch(ADVANCE_PHASE)` 推进阶段
  - 预期：`sys.phase` 和 `core.phase` 同步更新
  - 实际：只有 `sys.phase` 更新
  - 结果：后续命令验证失败

- **Edge Case**: 游戏初始化时 `sys.phase` 和 `core.phase` 都是 'play'
  - 预期：两者保持一致
  - 实际：初始化正常，只有推进阶段时才出现不同步

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- FlowHooks 中的 `onAutoContinueCheck` 必须继续从 `sys.phase` 读取阶段（已正确实现）
- 其他验证函数（如 `validateSkipAbility`）必须继续使用 `state` 参数读取 `sys.phase`（已正确实现）
- FlowSystem 的自动推进逻辑必须继续正常工作
- 回合结束事件触发后必须正确推进到下一回合的 play 阶段

**Scope:**
所有不涉及阶段同步的命令和事件应完全不受影响。这包括：
- 卡牌打出、抽取、弃牌等操作
- 能力效果执行（修正标记、印戒移动等）
- 遭遇战解析和结果变更
- 其他系统事件（如 `SYS_INTERACTION_RESOLVED`）

## Hypothesized Root Cause

基于代码分析，最可能的问题是：

1. **Reducer 缺少 SYS_PHASE_CHANGED 处理器**: `reduce.ts` 中的 switch 语句只有 `CARDIA_EVENTS.PHASE_CHANGED` 的 case，没有处理 FlowSystem 发射的 `SYS_PHASE_CHANGED`（即 `FLOW_EVENTS.PHASE_CHANGED`）系统事件。

2. **验证层读取错误的阶段字段**: `validateActivateAbility` 直接读取 `core.phase` 而非 `sys.phase`（FlowSystem 管理的权威来源）。

3. **临时修复方案掩盖了问题**: 之前在 `flowHooks.ts` 中手动发射 `CARDIA_EVENTS.PHASE_CHANGED` 事件，绕过了 FlowSystem 的设计，导致架构不一致。

4. **Pipeline 过滤系统事件**: `pipeline.ts` 中的 `reduceEventsToCore` 函数默认过滤 `SYS_` 开头的事件，但 `SYS_PHASE_CHANGED` 是例外（需要同步到 core）。检查代码发现 pipeline 已正确保留 `SYS_PHASE_CHANGED`，所以问题不在 pipeline 层。

## Correctness Properties

Property 1: Fault Condition - Phase Synchronization

_For any_ state where FlowSystem 推进阶段后（`SYS_PHASE_CHANGED` 事件发射），修复后的 reducer SHALL 同步更新 `core.phase` 以匹配 `sys.phase`，确保 `state.sys.phase === state.core.phase` 始终成立。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - Validation Logic

_For any_ state where `sys.phase` 和 `core.phase` 已同步（不触发 bug condition），修复后的验证函数 SHALL 产生与修复前相同的验证结果，保持所有现有验证逻辑的行为不变。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

基于 DiceThrone 的最佳实践（参考 `src/games/dicethrone/domain/reducer.ts` 第 844-850 行），采用以下修复方案：

**File**: `src/games/cardia/domain/reduce.ts`

**Function**: `reduce`

**Specific Changes**:

1. **添加 FLOW_EVENTS import**:
   - 在文件顶部添加：`import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';`
   - 位置：在现有 import 语句之后，`reduce` 函数定义之前

2. **在 reduce() switch 语句中添加 SYS_PHASE_CHANGED case**:
   - 位置：在 `case CARDIA_EVENTS.PHASE_CHANGED:` 之后
   - 代码：
     ```typescript
     case FLOW_EVENTS.PHASE_CHANGED:
         return reducePhaseChanged(core, event as any);
     ```
   - 说明：复用现有的 `reducePhaseChanged` 函数，将 `SYS_PHASE_CHANGED` 事件的 `payload.to` 映射到 `core.phase`

3. **保留 CARDIA_EVENTS.PHASE_CHANGED case**:
   - 向后兼容：如果有其他代码仍发射领域事件 `CARDIA_EVENTS.PHASE_CHANGED`，保持处理器不变
   - 位置：保持在原位置（第 106 行）

**File**: `src/games/cardia/domain/validate.ts`

**Function**: `validateActivateAbility`

**Specific Changes**:

1. **修改函数签名**:
   - 从：`validateActivateAbility(core: CardiaCore, command: ...)`
   - 到：`validateActivateAbility(state: MatchState<CardiaCore>, command: ...)`
   - 说明：接受完整的 `MatchState` 以访问 `sys.phase`

2. **修改阶段检查逻辑**:
   - 从：`if (core.phase !== 'ability')`
   - 到：`if (state.sys.phase !== 'ability')`
   - 位置：函数开头的阶段验证部分
   - 说明：从 FlowSystem 管理的权威来源读取阶段

3. **更新函数内部的 core 引用**:
   - 在函数开头添加：`const core = state.core;`
   - 保持其他逻辑不变（仍使用 `core.players`、`core.currentEncounter` 等）

4. **更新 validate() 中的调用点**:
   - 从：`return validateActivateAbility(core, command);`
   - 到：`return validateActivateAbility(state, command);`
   - 位置：`validate()` 函数的 switch 语句中

**File**: `src/games/cardia/domain/flowHooks.ts`

**No Changes Required**:
   - `onAutoContinueCheck` 已正确从 `sys.phase` 读取阶段
   - 临时修复方案（手动发射 PHASE_CHANGED）已在之前的 commit 中移除
   - 参考：`reports/flow-system-investigation.md` 确认 flowHooks 已符合最佳实践

### Implementation Notes

1. **Type Casting**: `reducePhaseChanged` 期望 `CARDIA_EVENTS.PHASE_CHANGED` 类型，但我们传入 `FLOW_EVENTS.PHASE_CHANGED`。两者的 payload 结构兼容（都有 `to` 字段），使用 `as any` 进行类型转换。

2. **Event Payload Mapping**: 
   - `CARDIA_EVENTS.PHASE_CHANGED` payload: `{ newPhase: string }`
   - `FLOW_EVENTS.PHASE_CHANGED` payload: `{ from: string, to: string, activePlayerId: string }`
   - `reducePhaseChanged` 函数需要修改以兼容两种 payload 格式

3. **Backward Compatibility**: 保留 `CARDIA_EVENTS.PHASE_CHANGED` case 确保向后兼容，即使当前代码中没有发射该事件。

4. **DiceThrone Pattern**: DiceThrone 使用相同的模式（参考 `src/games/dicethrone/domain/reducer.ts` 第 844-850 行），在 default case 中处理 `FLOW_EVENTS.PHASE_CHANGED`，我们采用更显式的 case 语句。

## Testing Strategy

### Validation Approach

测试策略遵循两阶段方法：首先验证修复前确实存在 bug（探索性测试），然后验证修复后 bug 消失且现有行为不变（修复验证 + 保留验证）。

### Exploratory Fault Condition Checking

**Goal**: 在修复前验证 bug 确实存在，确认根因分析正确。

**Test Plan**: 编写测试模拟 FlowSystem 自动推进阶段的场景，断言 `sys.phase` 和 `core.phase` 不一致。在未修复的代码上运行测试，观察失败并确认根因。

**Test Cases**:
1. **Auto-Advance from play to ability**: 双方打出卡牌后，FlowSystem 自动推进到 ability 阶段（未修复代码上会失败）
2. **Auto-Advance from ability to end**: 失败者跳过能力后，FlowSystem 自动推进到 end 阶段（未修复代码上会失败）
3. **Manual ADVANCE_PHASE command**: 手动调用 `dispatch(ADVANCE_PHASE)` 推进阶段（未修复代码上会失败）
4. **validateActivateAbility fails**: 在 ability 阶段尝试激活能力，验证失败并返回 "Not in ability phase" 错误（未修复代码上会失败）

**Expected Counterexamples**:
- `sys.phase = 'ability'` BUT `core.phase = 'play'`
- `validateActivateAbility` 返回 `{ valid: false, error: 'Not in ability phase' }`
- Possible causes: reducer 没有处理 `SYS_PHASE_CHANGED` 事件，验证层读取 `core.phase` 而非 `sys.phase`

### Fix Checking

**Goal**: 验证修复后，所有触发 bug condition 的输入都能产生正确的行为（阶段同步）。

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition(state) DO
  // 执行阶段推进命令
  result := executePipeline(state, ADVANCE_PHASE)
  
  // 断言阶段同步
  ASSERT result.state.sys.phase = result.state.core.phase
  
  // 断言验证通过
  validation := validateActivateAbility(result.state, ACTIVATE_ABILITY_command)
  ASSERT validation.valid = true
END FOR
```

### Preservation Checking

**Goal**: 验证修复后，所有不触发 bug condition 的输入都产生与修复前相同的结果（现有行为不变）。

**Pseudocode:**
```
FOR ALL state WHERE NOT isBugCondition(state) DO
  // 对于已同步的状态，验证行为不变
  ASSERT validate_original(state, command) = validate_fixed(state, command)
  
  // 对于其他命令，执行结果不变
  ASSERT executePipeline_original(state, command) = executePipeline_fixed(state, command)
END FOR
```

**Testing Approach**: Property-based testing 推荐用于保留验证，因为：
- 自动生成大量测试用例覆盖输入域
- 捕获手动单元测试可能遗漏的边界情况
- 提供强保证：所有非 bug 输入的行为不变

**Test Plan**: 编写单元测试覆盖现有功能，确保修复后行为不变。

**Test Cases**:
1. **Other validations unchanged**: 验证 `validatePlayCard`、`validateSkipAbility`、`validateEndTurn` 等函数行为不变
2. **FlowHooks unchanged**: 验证 `onAutoContinueCheck` 仍正常工作（从 `sys.phase` 读取）
3. **Event handling unchanged**: 验证其他事件处理器（`reduceCardPlayed`、`reduceEncounterResolved` 等）不受影响
4. **Turn flow unchanged**: 验证完整回合流程（play → ability → end → play）正常工作

### Unit Tests

- **Phase Synchronization Test**: 验证 `SYS_PHASE_CHANGED` 事件后 `sys.phase === core.phase`
- **Validation Test**: 验证 `validateActivateAbility` 在 ability 阶段返回 `{ valid: true }`
- **Reducer Test**: 验证 `reduce()` 正确处理 `FLOW_EVENTS.PHASE_CHANGED` 事件
- **Edge Case Test**: 验证游戏初始化时阶段同步正常

### Property-Based Tests

- **Phase Transition Property**: 对于任意阶段序列（play → ability → end → play），验证每次推进后 `sys.phase === core.phase`
- **Validation Consistency Property**: 对于任意状态和命令，验证 `validateActivateAbility` 的结果与 `sys.phase` 一致
- **Preservation Property**: 对于任意非阶段推进命令，验证修复前后执行结果相同

### Integration Tests

- **Complete Turn Flow**: 验证 play → ability → end → play 完整流程，每个阶段都检查同步
- **Ability Activation**: 验证能力激活交互在 ability 阶段正常弹出
- **Turn End**: 验证回合结束后正确推进到下一回合的 play 阶段
- **Auto-Advance**: 验证 FlowSystem 自动推进后阶段同步（双方打出卡牌 → ability 阶段）

### Test File Location

- Unit Tests: `src/games/cardia/__tests__/flow-system-phase-sync.test.ts`
- Integration Tests: `src/games/cardia/__tests__/integration-phase-flow.test.ts`
- E2E Tests: `e2e/cardia/phase-synchronization.spec.ts`（可选，如果需要验证 UI 交互）

## Implementation Checklist

修复完成后，必须确认以下检查项：

- [ ] `reduce.ts` 中添加了 `FLOW_EVENTS` import
- [ ] `reduce.ts` 的 switch 语句中添加了 `FLOW_EVENTS.PHASE_CHANGED` case
- [ ] `reducePhaseChanged` 函数兼容两种 payload 格式（`newPhase` 和 `to`）
- [ ] `validateActivateAbility` 函数签名修改为接受 `MatchState`
- [ ] `validateActivateAbility` 从 `state.sys.phase` 读取阶段
- [ ] `validate()` 中的调用点更新为传递 `state` 而非 `core`
- [ ] 所有单元测试通过（包括新增的阶段同步测试）
- [ ] 所有集成测试通过（完整回合流程）
- [ ] 运行 `npx tsc --noEmit` 确认无类型错误
- [ ] 运行 `npx eslint src/games/cardia/domain/reduce.ts src/games/cardia/domain/validate.ts` 确认无 lint 错误
- [ ] 手动测试：在浏览器中进行完整对局，验证能力激活正常工作

## References

- **DiceThrone Best Practice**: `src/games/dicethrone/domain/reducer.ts` 第 844-850 行
- **FlowSystem Documentation**: `src/engine/systems/FlowSystem.ts`
- **Investigation Report**: `reports/flow-system-investigation.md`
- **Bugfix Requirements**: `.kiro/specs/cardia-flow-system-phase-sync-fix/bugfix.md`
- **Pipeline Event Filtering**: `src/engine/pipeline.ts` 第 272-274 行（确认 `SYS_PHASE_CHANGED` 不被过滤）
