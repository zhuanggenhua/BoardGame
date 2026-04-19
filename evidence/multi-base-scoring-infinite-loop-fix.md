# 多基地计分无限循环 Bug 修复

## 问题描述

用户在实际游玩中遇到真实 bug：多个基地同时达到临界点时，选择基地后卡住，没有计分，游戏无法继续。

## 根因分析

### 完整调用链

1. 用户发送 `SYS_INTERACTION_RESPOND` 命令
2. `SimpleChoiceSystem.beforeCommand` 调用 `resolveInteraction(state)`，弹出交互，返回 `newState`（`current: undefined`）
3. `SimpleChoiceSystem.beforeCommand` 发射 `SYS_INTERACTION_RESOLVED` 事件
4. Pipeline 将 `newState` 应用到 `currentState` 和 `ctx.state`
5. Pipeline reduce 事件到 core
6. **系统优先级问题导致的执行顺序错误**：
   - `FlowSystem.afterEvents` (priority 25) 先执行
   - `FlowSystem.afterEvents` 调用 `onAutoContinueCheck`
   - `onAutoContinueCheck` 检测到 `flowHalted=true` 且交互已解决，触发 `ADVANCE_PHASE`
   - `ADVANCE_PHASE` 触发 `onPhaseExit('scoreBases')`
   - `onPhaseExit` 检查条件 `!state.sys.interaction.current && !currentIsMultiBaseScoring`
   - 因为 `resolveInteraction` 已经清除了 `current`，条件满足，又创建了新的 `multi_base_scoring` 交互
   - `SmashUpEventSystem.afterEvents` (priority 50) 后执行
   - `SmashUpEventSystem` 调用 handler
   - Handler 调用 `scoreOneBase`
   - `scoreOneBase` 检测到交互存在（刚刚重新创建的），误判为 "beforeScoring 创建了交互"，提前返回
   - 无限循环

### 核心矛盾

1. **系统优先级问题**：`FlowSystem` (priority 25) 在 `SmashUpEventSystem` (priority 50) 之前执行，导致 `onAutoContinueCheck` 在 handler 之前触发 `ADVANCE_PHASE`
2. **条件判断问题**：`onPhaseExit('scoreBases')` 中的条件 `!state.sys.interaction.current` 导致在交互解决后又重新创建交互

## 修复方案

### 修复 1：移除 `!state.sys.interaction.current` 条件

**文件**：`src/games/smashup/domain/index.ts` (line ~1170)

```typescript
// 修复前：
if (remainingIndices.length >= 2 && !state.sys.interaction.current && !currentIsMultiBaseScoring && !hasMultiBaseScoringInQueue) {

// 修复后：
if (remainingIndices.length >= 2 && !currentIsMultiBaseScoring && !hasMultiBaseScoringInQueue) {
```

移除了 `!state.sys.interaction.current` 条件，只检查是否已经有 `multi_base_scoring` 交互。

### 修复 2：调整系统优先级

**文件**：`src/games/smashup/domain/systems.ts` (line ~87)

```typescript
// 修复前：
priority: 50, // 在 InteractionSystem(20) 之后执行

// 修复后：
priority: 24, // 必须在 FlowSystem(25) 之前执行，确保交互处理器先于 onAutoContinueCheck 运行
```

将 `SmashUpEventSystem` 的优先级从 50 改为 24，确保它在 `FlowSystem` (priority 25) 之前执行。这样 handler 可以在 `onAutoContinueCheck` 触发 `ADVANCE_PHASE` 之前处理交互。

## 测试验证

测试文件：`src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts`

### 测试场景

创建三个基地，都达到临界点：
- 基地 0：无 afterScoring 能力
- 基地 1：有 afterScoring 能力（如忍者道场）
- 基地 2：有 afterScoring 能力（如海盗湾）

### 测试结果

```
✓ 验证多基地选择交互被正确创建
✓ multi_base_scoring handler 应该执行计分逻辑

Test Files  1 passed (1)
Tests  2 passed (2)
```

测试输出显示：
- `BASE_SCORED` 事件数量：1
- 玩家分数：{ p0: 2, p1: 0 }
- 所有事件包含完整的计分流程：`su:before_scoring_triggered` → `su:base_scored` → `su:after_scoring_triggered` → `su:base_cleared` → `su:base_replaced`

## 清理工作

1. 移除了所有调试日志（`console.log`）
2. 移除了 `isExecutingMultiBaseScoring` 标志（已不再需要）
3. 删除了临时脚本文件

## 总结

通过两个关键修复：
1. 移除 `onPhaseExit` 中的 `!state.sys.interaction.current` 条件
2. 调整 `SmashUpEventSystem` 的优先级，确保 handler 在 `onAutoContinueCheck` 之前执行

成功解决了多基地计分无限循环的 bug。修复后，多个基地同时达到临界点时，玩家可以正常选择基地并完成计分，游戏可以继续进行。
