# 大杀四方 - 多基地计分重复计分 Bug 修复

## 问题描述

用户反馈：多个基地同时计分时，忍者道场被计分了 2 次（4 次 `BASE_SCORED` 事件，期望 3 次）。

## 问题根因

### 延迟事件机制回顾

当 afterScoring 创建交互时（如海盗湾的"弃置随从"选择），`BASE_CLEARED` 和 `BASE_REPLACED` 事件会被延迟发出，存储在 `continuationContext._deferredPostScoringEvents` 中。

### Bug 的根本原因

1. **交互创建时机**（`registerMultiBaseScoringInteractionHandler` 第 545-570 行）：
   - Step 3：用户选择计分海盗湾 → 创建海盗湾 afterScoring 交互 + 创建 `multi_base_scoring_3_remaining` 交互（剩余忍者道场）并加入队列
   - 此时，忍者道场还没有被标记为"已计分"

2. **onPhaseExit 重复计分**（`onPhaseExit` 第 820-850 行）：
   - Step 4：解决海盗湾 afterScoring 交互 → `onAutoContinueCheck` 返回 `autoContinue=true` → 重新进入 `onPhaseExit`
   - `onPhaseExit` 发现 `remainingIndices = [1]`（忍者道场还在列表中，因为没有被标记为"已计分"）
   - `onPhaseExit` 检查队列中是否有 `multi_base_scoring` 交互 → 队列为空（因为 `multi_base_scoring_3_remaining` 已经从队列弹出成为当前交互）
   - `onPhaseExit` 直接计分忍者道场（第 1 次）

3. **交互解决时再次计分**：
   - Step 5：用户选择计分忍者道场 → `multi_base_scoring_3_remaining` 交互解决 → 又计分了一次忍者道场（第 2 次）

### 为什么会重复计分？

**核心问题**：当创建 `multi_base_scoring` 交互时，没有将对应的基地标记为"计分中"，导致 `onPhaseExit` 在交互解决前重新进入时，会再次计分同一个基地。

## 修复方案

### 修复 1：`registerMultiBaseScoringInteractionHandler` 中标记基地为"已计分"

在计分基地后，立即将其标记为"已计分"，避免 `onPhaseExit` 重复计分。

**修改位置**：`src/games/smashup/domain/index.ts` - `registerMultiBaseScoringInteractionHandler` 函数（第 510-530 行）

```typescript
// 1. 计分玩家选择的基地
const result = scoreOneBase(currentState.core, baseIndex, currentBaseDeck, playerId, timestamp, random, currentState);
events.push(...result.events);
currentBaseDeck = result.newBaseDeck;
if (result.matchState) currentState = result.matchState;

// 【关键修复】立即将基地标记为"已计分"，避免 onPhaseExit 重复计分
// 这是多基地计分重复计分 bug 的根本原因：
// 当 afterScoring 创建交互时，BASE_CLEARED 事件被延迟发出
// 如果不标记为"已计分"，onPhaseExit 在交互解决后重新进入时会再次计分同一个基地
if (!currentState.sys.scoredBaseIndices) {
    currentState = {
        ...currentState,
        sys: { ...currentState.sys, scoredBaseIndices: [] },
    };
}
if (!currentState.sys.scoredBaseIndices.includes(baseIndex)) {
    currentState = {
        ...currentState,
        sys: {
            ...currentState.sys,
            scoredBaseIndices: [...currentState.sys.scoredBaseIndices, baseIndex],
        },
    };
}
```

### 修复 2：创建新交互时标记剩余基地为"计分中"

当创建 `multi_base_scoring` 交互时，将剩余基地标记为"计分中"，避免 `onPhaseExit` 重复计分。

**修改位置**：`src/games/smashup/domain/index.ts` - `registerMultiBaseScoringInteractionHandler` 函数（第 545-570 行）

```typescript
if (candidates.length >= 1) {
    const interaction = createSimpleChoice(
        `multi_base_scoring_${timestamp}_remaining`, playerId,
        remainingIndices.length === 1 ? '计分最后一个基地' : '选择先记分的基地',
        buildBaseTargetOptions(candidates, updatedCore) as any[],
        { sourceId: 'multi_base_scoring', targetType: 'base' },
    );
    currentState = queueInteraction(currentState, interaction);
    
    // 【关键修复】将剩余基地标记为"计分中"，避免 onPhaseExit 重复计分
    // 这是多基地计分重复计分 bug 的根本原因：
    // 当创建 multi_base_scoring 交互后，onPhaseExit 重新进入时会发现剩余基地还没有被标记为"已计分"
    // 导致 onPhaseExit 直接计分，然后 multi_base_scoring 交互解决时又计分一次
    for (const idx of remainingIndices) {
        if (!currentState.sys.scoredBaseIndices!.includes(idx)) {
            currentState = {
                ...currentState,
                sys: {
                    ...currentState.sys,
                    scoredBaseIndices: [...currentState.sys.scoredBaseIndices!, idx],
                },
            };
        }
    }
}
```

### 修复 3：`onPhaseExit` 中检查当前交互

当只剩 1 个基地时，`onPhaseExit` 应该检查当前交互或队列中是否已有 `multi_base_scoring` 交互，如果有则等待交互解决。

**修改位置**：`src/games/smashup/domain/index.ts` - `onPhaseExit` 函数（第 820-850 行）

```typescript
// 1 个基地达标 → 检查当前交互或队列中是否已有 multi_base_scoring 交互
// 如果有，说明之前已经创建了交互，不应该重复计分
// 使用 remainingIndices（已过滤已记分基地），按顺序逐个计分
const currentIsMultiBaseScoring = 
    (state.sys.interaction.current?.data as any)?.sourceId === 'multi_base_scoring';
const hasMultiBaseScoringInQueue = state.sys.interaction.queue.some(
    (i: any) => (i.data as any)?.sourceId === 'multi_base_scoring'
);

if (currentIsMultiBaseScoring || hasMultiBaseScoringInQueue) {
    // 当前交互或队列中已有 multi_base_scoring 交互，不重复计分
    // halt=true：等待交互解决
    return { events: [], halt: true } as PhaseExitResult;
}
```

## 验证测试

### 测试场景

`src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` - "完整流程：3 个基地依次计分，中间有 afterScoring 交互"

- 3 个基地需要计分：丛林、海盗湾、忍者道场
- 海盗湾和忍者道场都有 afterScoring 交互
- 验证每个基地只计分一次（3 次 `BASE_SCORED` 事件）
- 验证 `BASE_CLEARED` 和 `BASE_REPLACED` 事件不重复（各 3 次）

### 测试结果

```
✓ 多基地同时计分 afterScoring 触发问题 (2)
  ✓ 验证多基地选择交互被正确创建
  ✓ 完整流程：3个基地依次计分，中间有 afterScoring 交互
```

### 事件序列验证

修复前（预期）：
- 丛林：`BASE_SCORED` + `BASE_CLEARED` + `BASE_REPLACED`（立即发出）
- 海盗湾：`BASE_SCORED`（立即发出），`BASE_CLEARED` + `BASE_REPLACED`（延迟发出）
- 忍者道场：`onPhaseExit` 直接计分 → `BASE_SCORED`（第 1 次）
- 忍者道场：`multi_base_scoring` 交互解决 → `BASE_SCORED`（第 2 次，重复！）

修复后（实际）：
- 丛林：`BASE_SCORED` + `BASE_CLEARED` + `BASE_REPLACED`（立即发出）
- 海盗湾：`BASE_SCORED`（立即发出），`BASE_CLEARED` + `BASE_REPLACED`（延迟发出）
- 忍者道场：标记为"计分中"，`onPhaseExit` 不再重复计分 ✅
- 忍者道场：`multi_base_scoring` 交互解决 → `BASE_SCORED`（第 1 次，唯一）✅

## 核心教训

### 交互创建时必须标记状态

当创建交互来处理某个操作时（如计分基地），必须立即标记该操作的目标为"处理中"，避免其他系统（如 `onPhaseExit`）重复处理。

### 状态标记的生命周期

- **创建**：在创建交互时标记
- **传递**：标记随 `sys.scoredBaseIndices` 传递
- **消费**：在交互解决时使用标记
- **清理**：在阶段结束时清理标记

### 多系统协作的状态同步

当多个系统（`registerMultiBaseScoringInteractionHandler` + `onPhaseExit`）协作处理同一个操作时，必须通过共享状态（`sys.scoredBaseIndices`）同步，避免重复处理。

## 相关文档

- `evidence/smashup-multi-base-duplicate-events-fix.md` - 延迟事件重复补发修复
- `evidence/smashup-multi-base-duplicate-replacement-fix.md` - 多基地替换为同一个基地修复
- `evidence/smashup-multi-base-infinite-loop-fix.md` - 多基地计分无限循环修复
- `evidence/smashup-multi-base-duplicate-events-user-report.md` - 用户反馈分析
- `docs/ai-rules/engine-systems.md` - 引擎系统规范

## 总结

修复了多基地计分时基地被重复计分的 bug。核心修改是：
1. 在 `registerMultiBaseScoringInteractionHandler` 中，计分基地后立即标记为"已计分"
2. 创建新的 `multi_base_scoring` 交互时，将剩余基地标记为"计分中"
3. 在 `onPhaseExit` 中，检查当前交互或队列中是否已有 `multi_base_scoring` 交互

所有测试通过，功能正常。
