# 大杀四方 - 多基地计分重复事件 Bug 修复

## 问题描述

用户反馈：多个基地同时计分时，托尔图加（海盗湾）被清空和替换了 3 次，ActionLog 显示重复的 `BASE_CLEARED` 和 `BASE_REPLACED` 事件。

## 问题根因

### 延迟事件机制回顾

当 afterScoring 创建交互时（如海盗湾的"弃置随从"选择），`BASE_CLEARED` 和 `BASE_REPLACED` 事件会被延迟发出，存储在 `continuationContext._deferredPostScoringEvents` 中。这样做是为了确保交互期间场上的随从仍然可见（targetType: 'minion' 的交互需要看到随从）。

### Bug 的根本原因

1. **延迟事件的创建**（`scoreOneBase` 第 430-440 行）：
   - 当 afterScoring 创建交互时，延迟事件被附加到**第一个交互**上
   - 例如：海盗湾计分后，`_deferredPostScoringEvents` 包含 `[BASE_CLEARED, BASE_REPLACED]`

2. **延迟事件的补发**（`registerMultiBaseScoringInteractionHandler` 第 485-498 行）：
   - 每次 `multi_base_scoring` 交互解决时，都会检查 `_deferredPostScoringEvents`
   - 如果有延迟事件，就补发它们
   - **问题**：补发后没有清除 `_deferredPostScoringEvents`

3. **重复补发的链路**：
   - 当有多个基地需要计分时，会创建多个 `multi_base_scoring` 交互
   - 每个交互都携带了**相同的** `_deferredPostScoringEvents`（因为是从第一个交互复制过来的）
   - 结果：每个交互解决时都会补发一次相同的延迟事件

### 为什么会有 3 次重复？

假设场景：3 个基地需要计分，第 2 个基地（海盗湾）有 afterScoring 交互

1. **第 1 次**：用户选择第 2 个基地（海盗湾）
   - 计分 → 创建 afterScoring 交互 → 延迟事件存储到 `_deferredPostScoringEvents`
   
2. **第 2 次**：afterScoring 交互解决
   - 补发延迟事件（第 1 次）→ `BASE_CLEARED` + `BASE_REPLACED`
   - 创建新的 `multi_base_scoring` 交互（剩余 1 个基地）
   - **问题**：`_deferredPostScoringEvents` 没有被清除，被复制到新交互中

3. **第 3 次**：用户选择最后一个基地
   - 补发延迟事件（第 2 次）→ `BASE_CLEARED` + `BASE_REPLACED`（重复！）
   - 计分最后一个基地

4. **第 4 次**（如果最后一个基地也有 afterScoring 交互）：
   - 补发延迟事件（第 3 次）→ `BASE_CLEARED` + `BASE_REPLACED`（再次重复！）

## 修复方案

在补发延迟事件后，**立即清除** `_deferredPostScoringEvents`，避免下一个交互再次补发。

### 修改位置

`src/games/smashup/domain/index.ts` - `registerMultiBaseScoringInteractionHandler` 函数

### 修改内容

```typescript
// 【修复】如果有延迟事件，先补发
if (deferredEvents && deferredEvents.length > 0) {
    console.log('[multi_base_scoring] 补发延迟事件:', deferredEvents.length);
    events.push(...deferredEvents as SmashUpEvent[]);
    
    // 立即 reduce 到本地 core 副本，确保后续逻辑使用最新状态
    let updatedCore = currentState.core;
    for (const evt of deferredEvents) {
        updatedCore = reduce(updatedCore, evt as SmashUpEvent);
    }
    currentState = { ...currentState, core: updatedCore };
    
    // 【关键修复】补发后立即清除延迟事件，避免下一个交互再次补发
    // 这是多基地计分重复事件 bug 的根本原因：
    // 当有多个基地需要计分时，每个 multi_base_scoring 交互都会携带相同的 _deferredPostScoringEvents
    // 如果不清除，每个交互解决时都会补发一次，导致 BASE_CLEARED/BASE_REPLACED 重复 N 次
    if (_iData?.continuationContext) {
        delete (_iData.continuationContext as any)._deferredPostScoringEvents;
    }
}
```

## 验证测试

### 测试场景

`src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` - "完整流程：3 个基地依次计分，中间有 afterScoring 交互"

- 3 个基地需要计分：丛林、海盗湾、忍者道场
- 海盗湾和忍者道场都有 afterScoring 交互
- 验证 `BASE_CLEARED` 和 `BASE_REPLACED` 事件不重复

### 测试结果

```
✓ 多基地同时计分 afterScoring 触发问题 (2)
  ✓ 验证多基地选择交互被正确创建
  ✓ 完整流程：3个基地依次计分，中间有 afterScoring 交互
```

### 事件序列验证

修复前（预期）：
- 丛林：`BASE_CLEARED` + `BASE_REPLACED`（立即发出）
- 海盗湾：延迟发出
- 忍者道场：补发海盗湾的延迟事件 → `BASE_CLEARED` + `BASE_REPLACED`（第 1 次）
- 忍者道场：补发海盗湾的延迟事件 → `BASE_CLEARED` + `BASE_REPLACED`（第 2 次，重复！）
- 忍者道场：补发海盗湾的延迟事件 → `BASE_CLEARED` + `BASE_REPLACED`（第 3 次，重复！）

修复后（实际）：
- 丛林：`BASE_CLEARED` + `BASE_REPLACED`（立即发出）
- 海盗湾：延迟发出
- 忍者道场：补发海盗湾的延迟事件 → `BASE_CLEARED` + `BASE_REPLACED`（第 1 次）
- 忍者道场：`_deferredPostScoringEvents` 已清除，不再重复补发 ✅

### 所有基地能力测试

```
✓ src/games/smashup/__tests__/baseAbilities.test.ts (7 tests)
✓ src/games/smashup/__tests__/baseAbilityIntegration.test.ts (15 tests)
```

## 核心教训

### 延迟事件必须在补发后清除

当使用 `continuationContext` 存储延迟事件时，必须在补发后立即清除，避免事件在交互链中传播时被多次补发。

### 事件驱动架构中的状态同步

在循环中多次调用产生事件的函数时，必须在每次调用后立即 reduce 事件，确保后续调用使用最新状态。这个原则在之前的修复中已经应用（`scoreOneBase` 中的 `beforeScoringTriggeredBases` 标记），现在扩展到延迟事件的清理。

### 交互链中的数据传递

当交互链中需要传递数据时（如 `_deferredPostScoringEvents`），必须明确数据的生命周期：
- **创建**：在哪个交互中创建？
- **传递**：如何传递给下一个交互？
- **消费**：在哪个交互中消费？
- **清理**：消费后是否需要清除？

本次 bug 的根本原因是缺少"清理"步骤，导致数据在交互链中无限传播。

## 相关文档

- `evidence/smashup-multi-base-duplicate-replacement-fix.md` - 之前修复的多基地替换为同一个基地的 bug
- `evidence/smashup-multi-base-infinite-loop-fix.md` - 之前修复的多基地计分无限循环 bug
- `docs/ai-rules/engine-systems.md` - 引擎系统规范，包含交互系统和延迟事件机制

## 总结

修复了多基地计分时延迟事件被多次补发的 bug。核心修改是在补发延迟事件后立即清除 `_deferredPostScoringEvents`，避免事件在交互链中传播时被重复补发。所有测试通过，功能正常。
