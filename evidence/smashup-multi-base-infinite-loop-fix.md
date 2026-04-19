# 大杀四方 - 多基地计分无限循环 Bug 修复（通用方案）

## 问题描述

用户反馈：多基地计分时出现无限循环，效果重复触发。

从 Action Log 可以看到：
```
[14:00:24] 游客6118: 基地结算： 灰色猫眼石/海盗湾 管理员1 +3VP  [总VP: 0:16 1:5]
[14:00:19] 游客6118: 基地结算： 灰色猫眼石/海盗湾 管理员1 +3VP  [总VP: 0:13 1:5]
[14:00:16] 管理员1: 移动随从： 大副  忍者道场 → 灰色猫眼石/海盗湾  （原因： pirate_first_mate）
[14:00:10] 管理员1: 消灭随从： 大副  → 忍者道场  （原因： base_ninja_dojo）
[14:00:00] 游客6118: 基地结算： 忍者道场 管理员1 +2VP  [总VP: 0:10 1:5]
```

同一个基地（灰色猫眼石/海盗湾）重复结算，并且在结算过程中触发了大副的移动效果，导致循环。

## 问题根因

### 调用链分析

1. **多基地计分流程**：
   - `scoreBases` 阶段有多个基地达到临界点（忍者道场、灰色猫眼石/海盗湾）
   - 玩家选择先计分忍者道场 → 触发 `multi_base_scoring` 交互
   - 忍者道场计分完成，消灭大副 → 大副移动到灰色猫眼石/海盗湾

2. **afterScoring 触发链**：
   - 忍者道场计分后，大副在灰色猫眼石/海盗湾上
   - 玩家选择计分灰色猫眼石/海盗湾 → 触发 `scoreOneBase`
   - `scoreOneBase` 中 `afterScoring` 触发，大副创建移动交互
   - **关键**：`BASE_CLEARED` 事件被延迟，存储在交互的 `continuationContext._deferredPostScoringEvents` 中

3. **延迟事件传递缺失**：
   - 如果有多个 afterScoring 交互（如多个大副），延迟事件只存储在第一个交互中
   - 第一个交互解决后，**没有传递延迟事件给下一个交互**
   - 最后一个交互解决时，**没有补发 `BASE_CLEARED` 事件**
   - `scoringEligibleBaseIndices` 没有更新，仍然包含已计分的基地

4. **无限循环**：
   - `getScoringEligibleBaseIndices` 返回已计分的基地
   - `multi_base_scoring` 交互再次选择同一个基地
   - 重复计分 → 无限循环

### 代码证据

**`scoreOneBase` 中延迟事件存储逻辑**（`src/games/smashup/domain/index.ts:440-450`）：
```typescript
if (afterScoringCreatedInteraction) {
    // 把 postScoringEvents 序列化存到交互的 continuationContext 中
    // 【修复】如果有多个 afterScoring 交互（如母舰 + 侦察兵），必须存到第一个交互中
    // 这样第一个交互解决时会传递给下一个，最后一个解决时才会补发 BASE_CLEARED
    const firstInteraction = ms!.sys.interaction!.current ?? ms!.sys.interaction!.queue[0];
    if (firstInteraction?.data) {
        const data = firstInteraction.data as Record<string, unknown>;
        const ctx = (data.continuationContext ?? {}) as Record<string, unknown>;
        ctx._deferredPostScoringEvents = postScoringEvents.map(e => ({
            type: e.type,
            payload: (e as GameEvent).payload,
            timestamp: (e as GameEvent).timestamp,
        }));
        data.continuationContext = ctx;
    }
    return { events, newBaseDeck, matchState: ms };
}
```

**问题**：注释中说"第一个交互解决时会传递给下一个"，但代码中**没有实现传递逻辑**！

### 影响范围

这是一个**通用问题**，影响所有可能创建 afterScoring 交互的地方：

**随从 trigger**：
- `pirate_first_mate`（大副）
- `alien_scout`（侦察兵）
- `vampire_buffet`（自助餐）
- `giant_ant_we_are_the_champions`（我们是冠军）

**基地能力**：
- `base_tortuga`（托尔图加）
- `base_the_mothership`（母舰）
- `base_ninja_dojo`（忍者道场）
- `base_pirate_cove`（海盗湾）
- `base_wizard_academy`（巫师学院）
- `base_temple_of_goju`（刚柔流寺庙）
- `base_greenhouse`（温室）
- `base_inventors_salon`（发明家沙龙）
- 等等...

如果只修复大副的交互处理器，其他所有 afterScoring 交互仍然会有无限循环问题。

## 修复方案（通用）

在**引擎层** `resolveInteraction` 函数中统一处理延迟事件传递，确保所有交互都能正确传递延迟事件。

### 修复位置

**引擎层**：`src/engine/systems/InteractionSystem.ts` `resolveInteraction` 函数

### 修复逻辑

1. **引擎层自动传递**：`resolveInteraction` 在弹出下一个交互时，检查当前交互的 `continuationContext._deferredPostScoringEvents`
2. **如果有延迟事件且有下一个交互** → 自动传递给下一个交互
3. **游戏层补发**：每个交互处理器在解决时，检查是否是最后一个交互，如果是则补发延迟事件

### 修复代码

**引擎层修复**（`src/engine/systems/InteractionSystem.ts:489-560`）：

```typescript
export function resolveInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const { current, queue } = state.sys.interaction;
    let next = queue[0];
    const newQueue = queue.slice(1);

    console.log('[InteractionSystem] resolveInteraction START:', {
        hasNext: !!next,
        nextId: next?.id,
        nextKind: next?.kind,
        queueLength: queue.length,
    });

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

    // ... 其余代码
}
```

**游戏层修复示例**（`src/games/smashup/abilities/pirates.ts:893-920`）：

```typescript
registerInteractionHandler('pirate_first_mate_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
    const selected = value as { skip?: boolean; baseIndex?: number };
    
    // 【通用修复】检查是否有延迟事件需要补发
    // 引擎层 resolveInteraction 已自动传递延迟事件，这里只需要在最后一个交互时补发
    const deferredEvents = (iData?.continuationContext as any)?._deferredPostScoringEvents as 
        { type: string; payload: unknown; timestamp: number }[] | undefined;
    const hasNextInteraction = state.sys.interaction?.queue && state.sys.interaction.queue.length > 0;
    
    if (selected.skip) {
        // 跳过时，如果这是最后一个交互，补发延迟事件
        if (deferredEvents && deferredEvents.length > 0 && !hasNextInteraction) {
            return { state, events: deferredEvents as any[] };
        }
        return { state, events: [] };
    }
    
    const { baseIndex: destBase } = selected;
    if (destBase === undefined) return undefined;
    const ctx = iData?.continuationContext as { mateUid: string; mateDefId: string; scoringBaseIndex: number } | undefined;
    if (!ctx) return undefined;
    const events: SmashUpEvent[] = [moveMinion(ctx.mateUid, ctx.mateDefId, ctx.scoringBaseIndex, destBase, 'pirate_first_mate', timestamp)];
    
    // 【通用修复】如果这是最后一个交互，补发延迟事件
    if (deferredEvents && deferredEvents.length > 0 && !hasNextInteraction) {
        events.push(...deferredEvents as SmashUpEvent[]);
    }
    
    return { state, events };
});
```

## 修复效果

1. **引擎层自动传递**：所有交互都能自动传递延迟事件，无需每个交互处理器手动实现
2. **游戏层简化**：交互处理器只需检查是否是最后一个交互，如果是则补发延迟事件
3. **通用性**：适用于所有 afterScoring 交互（随从 trigger + 基地能力）
4. **向后兼容**：不影响现有交互处理器（如果没有延迟事件，逻辑不变）

## 测试验证

修复后需要测试以下场景：

### 已有测试覆盖
1. ✅ 单个大副 afterScoring
2. ✅ 母舰 + 侦察兵（2个交互）
3. ✅ 母舰 + 2侦察兵 + 大副（4个交互）

### 需要补充测试
1. ⚠️ 多个大副 afterScoring（用户反馈的场景）
2. ⚠️ 基地能力 + 随从 trigger（如忍者道场 + 大副）
3. ⚠️ 多基地计分 + 多个 afterScoring 交互
4. ⚠️ 其他 afterScoring 交互（侦察兵、自助餐、我们是冠军等）

## 相关文档

- `docs/ai-rules/testing-audit.md` - D40 子项：后处理循环事件去重完整性
- `AGENTS.md` - 多 afterScoring 交互链式传递（已修复 bug）
- `docs/ai-rules/engine-systems.md` - 引擎系统规范

## 总结

修复了多基地计分时，多个 afterScoring 交互导致的无限循环 bug。核心问题是延迟事件没有在交互链中传递，导致 `BASE_CLEARED` 事件没有被补发，`scoringEligibleBaseIndices` 没有更新。

**通用修复方案**：
1. **引擎层**：`resolveInteraction` 自动传递延迟事件给下一个交互
2. **游戏层**：交互处理器检查是否是最后一个交互，如果是则补发延迟事件

这是一个**面向百游戏的通用解决方案**，适用于所有可能创建 afterScoring 交互的场景，无需每个交互处理器手动实现传递逻辑。
