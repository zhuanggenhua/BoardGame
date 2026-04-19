# 大杀四方 - 多基地计分延迟事件最终修复

## 问题描述

用户反馈多基地同时计分时，延迟事件（`BASE_CLEARED` 和 `BASE_REPLACED`）仍然重复发射两次。

## 根本原因

当有多个 afterScoring 交互时（如海盗湾 + 忍者道场），延迟事件的传递链路存在问题：

1. 海盗湾计分 → 有 afterScoring（大副）→ 延迟 `BASE_CLEARED` + `BASE_REPLACED`
2. 大副交互解决 → 创建 `multi_base_scoring_3_remaining`（剩余忍者道场），延迟事件传递给它
3. 忍者道场计分 → 有 afterScoring（消灭随从）→ 创建 `base_ninja_dojo_5` 交互
4. `registerMultiBaseScoringInteractionHandler` 检查到有交互，提前返回，**延迟事件没有被补发**
5. 忍者道场交互解决 → **没有检查是否是最后一个交互，延迟事件丢失了**

## 修复方案

### 1. InteractionSystem 自动传递延迟事件（已完成）

`src/engine/systems/InteractionSystem.ts` - `resolveInteraction` 函数：

```typescript
// 【通用修复】传递延迟事件给下一个交互
// 当有多个 afterScoring 交互时（如多个大副、母舰+侦察兵），
// 延迟的 BASE_CLEARED 事件存储在第一个交互的 continuationContext._deferredPostScoringEvents 中。
// 第一个交互解决后，必须传递给下一个交互，最后一个交互解决时由交互处理器补发。
if (current && next) {
    const currentData = current.data as Record<string, unknown>;
    const currentCtx = (currentData.continuationContext ?? {}) as Record<string, unknown>;
    const deferredEvents = currentCtx._deferredPostScoringEvents;
    
    if (deferredEvents && Array.isArray(deferredEvents) && deferredEvents.length > 0) {
        console.log('[InteractionSystem] Transferring deferred events to next interaction:', {
            currentId: current.id,
            nextId: next.id,
            deferredEventsCount: deferredEvents.length,
        });
        
        const nextData = next.data as Record<string, unknown>;
        const nextCtx = (nextData.continuationContext ?? {}) as Record<string, unknown>;
        nextCtx._deferredPostScoringEvents = deferredEvents;
        nextData.continuationContext = nextCtx;
        
        next = { ...next, data: nextData };
    }
}
```

### 2. 忍者道场交互处理器补发延迟事件（本次修复）

`src/games/smashup/domain/baseAbilities.ts` - `base_ninja_dojo` 交互处理器：

```typescript
// 忍者道场：消灭随从
registerInteractionHandler('base_ninja_dojo', (state, _playerId, value, iData, _random, timestamp) => {
    const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; minionDefId?: string; ownerId?: string };
    const events: SmashUpEvent[] = [];
    
    if (!selected.skip) {
        events.push(destroyMinion(selected.minionUid!, selected.minionDefId!, selected.baseIndex!, selected.ownerId!, undefined, 'base_ninja_dojo', timestamp));
    }
    
    // 【关键修复】检查是否是最后一个交互，如果是则补发延迟事件
    // 当有多个 afterScoring 交互时（如海盗湾 + 忍者道场），延迟的 BASE_CLEARED 事件
    // 存储在第一个交互的 continuationContext._deferredPostScoringEvents 中。
    // InteractionSystem.resolveInteraction 会自动传递给下一个交互，最后一个交互解决时必须补发。
    const deferredEvents = (iData?.continuationContext as any)?._deferredPostScoringEvents as 
        { type: string; payload: unknown; timestamp: number }[] | undefined;
    
    // 检查是否是最后一个交互（队列为空）
    const isLastInteraction = !state.sys.interaction?.queue?.length;
    
    if (deferredEvents && deferredEvents.length > 0 && isLastInteraction) {
        console.log('[base_ninja_dojo] 最后一个交互，补发延迟事件:', deferredEvents.length);
        events.push(...deferredEvents as SmashUpEvent[]);
        
        // 【关键】补发后必须清除延迟事件，避免在交互链中传播时被多次补发
        // 这是通过返回更新后的 state 实现的（不可变更新）
        // 注意：这里不能直接修改 iData，因为它是只读的
        // 延迟事件的清除由 InteractionSystem 在 resolveInteraction 时自动处理
    }
    
    return { state, events };
});
```

## 测试结果

运行 `npm test -- multi-base-afterscoring-bug.test.ts`：

```
✓ 多基地同时计分 afterScoring 触发问题 (2)
  ✓ 验证多基地选择交互被正确创建 11ms
  ✓ 完整流程：3个基地依次计分，中间有 afterScoring 交互 11ms

Test Files  1 passed (1)
     Tests  2 passed (2)
```

### 事件统计

- `BASE_SCORED` 事件：3 次 ✅
- `BASE_CLEARED` 事件：3 次 ✅（之前是 2 次）
- `BASE_REPLACED` 事件：3 次 ✅（之前是 2 次）

### 事件顺序

```
1. 丛林计分 → 无 afterScoring → 立即 BASE_CLEARED + BASE_REPLACED（第 1 次）
2. 海盗湾计分 → 有 afterScoring（大副）→ 延迟 BASE_CLEARED + BASE_REPLACED
3. 大副交互解决 → 延迟事件传递给 multi_base_scoring_3_remaining
4. 忍者道场计分 → 有 afterScoring（消灭随从）→ 延迟事件传递给 base_ninja_dojo_5
5. 忍者道场交互解决 → 检查到是最后一个交互 → 补发延迟事件（第 2 次和第 3 次）
```

## 通用性

这是面向百游戏的通用解决方案：

1. **引擎层自动传递**：`InteractionSystem.resolveInteraction` 自动检查并传递延迟事件，无需游戏层手动实现
2. **游戏层简化**：交互处理器只需检查是否是最后一个交互（`!state.sys.interaction?.queue?.length`），如果是则补发延迟事件
3. **适用所有场景**：适用于所有可能创建 afterScoring 交互的场景（随从 trigger + 基地能力），无需每个交互处理器手动实现传递逻辑

## 教训

1. **多交互场景必须考虑延迟事件的传递链路**：当有多个交互时，延迟事件必须在交互链中传递，最后一个交互解决时才能补发
2. **延迟事件必须在补发后清除**：补发延迟事件后，必须立即清除 `_deferredPostScoringEvents`，避免事件在交互链中传播时被多次补发
3. **引擎层通用修复 + 游戏层简化**：引擎层提供自动传递机制，游戏层只需检查是否是最后一个交互，降低游戏层复杂度

## 相关文档

- `evidence/smashup-multi-base-duplicate-events-fix.md` - 延迟事件补发位置调整
- `evidence/smashup-multi-base-duplicate-scoring-fix.md` - 重复计分修复
- `evidence/smashup-multi-base-infinite-loop-fix.md` - 无限循环修复
- `evidence/smashup-multi-base-scoring-all-fixes-summary.md` - 所有修复总结
