# SmashUp 重复 afterScoring 触发 Bug

## 问题描述

用户反馈：基地效果重复触发，跳过响应也要跳过两次。

## 用户日志

```
[20:14:24] 管理员1: 移动随从： 大副  托尔图加 → 刚柔流寺庙  （原因： 海盗湾：移动随从到其他基地）
[20:14:20] 管理员1: 移动随从： 大副  托尔图加 → 刚柔流寺庙  （原因： pirate_first_mate）
```

## State 快照

```json
{
  "bases": [
    {"defId": "base_tortuga", "minions": [], "ongoingActions": []},
    {"defId": "base_temple_of_goju", "minions": [...], "ongoingActions": []},
    {"defId": "base_the_hill", "minions": [], "ongoingActions": []}
  ],
  "beforeScoringTriggeredBases": [0],
  "afterScoringTriggeredBases": [0]
}
```

## ActionLog 历史

```
[08:00:00] 管理员1: 清空灰色猫眼石/海盗湾
[08:00:00] 管理员1: 基地替换： 灰色猫眼石/海盗湾  →  托尔图加
```

## 根因分析

### 问题不是"托尔图加被触发两次"

从日志可以看到，两次移动的原因不同：
1. **第一次**：`pirate_first_mate`（大副的 afterScoring 能力）
2. **第二次**：`海盗湾：移动随从到其他基地`（海盗湾基地的 afterScoring 能力）

### 实际问题：两个不同的 afterScoring 能力都被触发了

基地 0 原本是"海盗湾"（base_pirate_cove），计分后被替换成了"托尔图加"（base_tortuga）。

**海盗湾的 afterScoring 能力**：
- 描述："在这个基地计分后，每位非冠军玩家可以移动他在这里的一个随从到其他基地"
- 代码：`src/games/smashup/domain/baseAbilities.ts` line 974

**大副的 afterScoring 能力**：
- 描述："基地计分后将副官移动到其他基地（而非弃牌堆）"
- 代码：`src/games/smashup/abilities/pirates.ts` line 42

### 为什么两个能力都被触发了？

根据 `scoreOneBase` 函数的逻辑（`src/games/smashup/domain/index.ts` line 245-280）：

1. **触发基地的 afterScoring 能力**（海盗湾）
2. **触发 ongoing afterScoring**（大副）

两个触发点都在 `scoreOneBase` 函数中，都会被执行。

### 问题：为什么同一个随从被移动了两次？

从日志可以看到，大副被移动了两次：
1. 第一次：大副的 afterScoring 能力触发，将大副从托尔图加移动到刚柔流寺庙
2. 第二次：海盗湾的 afterScoring 能力触发，将大副从托尔图加移动到刚柔流寺庙

**但是，大副在第一次移动后已经不在托尔图加了，为什么海盗湾的 afterScoring 能力还能移动它？**

### 关键问题：海盗湾的 afterScoring 能力在基地替换后仍然被触发

根据 `scoreOneBase` 函数的逻辑：

```typescript
// 触发 afterScoring 基地能力（使用 reduce 后的 core，包含 beforeScoring 效果 + ARMED special 效果）
const afterCtx = {
    state: updatedCore,
    matchState: ms,
    baseIndex,
    baseDefId: base.defId,  // ⚠️ 这里使用的是原始基地的 defId（海盗湾）
    playerId: pid,
    rankings,
    now,
};
afterResult = triggerBaseAbility(base.defId, 'afterScoring', afterCtx);
```

**问题**：`base.defId` 是原始基地的 defId（海盗湾），而不是替换后的基地（托尔图加）。

但是，基地替换是在 `BASE_CLEARED` 和 `BASE_REPLACED` 事件中完成的，这些事件在 afterScoring 能力触发**之后**才发出。

所以，海盗湾的 afterScoring 能力应该在基地替换**之前**被触发，此时基地还是海盗湾。

### 真正的问题：ongoing afterScoring 使用的是替换后的基地状态

根据 `scoreOneBase` 函数的逻辑：

```typescript
// 将 afterScoring 基地能力产生的事件 reduce 到 core，
// 确保 ongoing afterScoring 触发器使用最新状态。
let afterScoringCore = updatedCore;
for (const evt of afterResult.events) {
    afterScoringCore = reduce(afterScoringCore, evt as SmashUpEvent);
}

// 触发 ongoing afterScoring（如 pirate_first_mate 移动到其他基地）
// 使用 reduce 后的 core，包含基地能力的效果（如随从已被放入牌库底）
const afterScoringEvents = fireTriggers(afterScoringCore, 'afterScoring', {
    state: afterScoringCore,
    playerId: pid,
    baseIndex,
    rankings,
    matchState: ms,
    random: rng,
    now,
});
```

**问题**：`afterScoringCore` 是在 afterScoring 基地能力触发后 reduce 的，但是 `BASE_CLEARED` 和 `BASE_REPLACED` 事件还没有被 reduce。

所以，ongoing afterScoring 触发时，基地还是海盗湾，而不是托尔图加。

### 为什么大副被移动了两次？

1. **海盗湾的 afterScoring 能力触发**：
   - 收集海盗湾上的非冠军随从（包括大副）
   - 创建交互，让玩家选择移动哪个随从
   - 玩家选择大副，大副被移动到刚柔流寺庙

2. **ongoing afterScoring 触发**（大副的 afterScoring 能力）：
   - 收集所有基地上的大副
   - 但是，大副已经被移动到刚柔流寺庙了，不在海盗湾上了
   - **问题**：为什么大副还能被移动？

### 关键发现：海盗湾的 afterScoring 能力使用了 continuation data

根据 `src/games/smashup/domain/baseAbilities.ts` line 974-1070：

```typescript
registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
    // ...
    // 注意：afterScoring 能力在 BASE_SCORED 事件处理前收集，此时随从仍在基地上。
    // 但交互解决时随从可能已进入弃牌堆（BASE_CLEARED），因此将随从信息存入 continuation data。
    // ...
});
```

**问题**：海盗湾的 afterScoring 能力在收集随从时，使用的是当前基地上的随从列表。但是，交互解决时，随从可能已经被移动了。

### 时序问题

1. **scoreOneBase 开始**：基地 0 是海盗湾
2. **触发海盗湾的 afterScoring 能力**：收集海盗湾上的非冠军随从（包括大副）
3. **触发 ongoing afterScoring**（大副的 afterScoring 能力）：收集所有基地上的大副
4. **创建交互**：海盗湾的 afterScoring 能力创建交互，让玩家选择移动哪个随从
5. **创建交互**：大副的 afterScoring 能力创建交互，让玩家选择移动到哪个基地
6. **交互解决**：玩家先解决大副的交互，大副被移动到刚柔流寺庙
7. **交互解决**：玩家再解决海盗湾的交互，但是大副已经不在海盗湾上了

**问题**：海盗湾的交互在创建时收集了大副，但是交互解决时大副已经被移动了。

### 根本原因

**海盗湾的 afterScoring 能力和大副的 afterScoring 能力都创建了交互，但是它们的执行顺序是：**

1. 海盗湾的 afterScoring 能力先创建交互（收集大副）
2. 大副的 afterScoring 能力后创建交互
3. 大副的交互先解决（因为是后创建的，在队列前面）
4. 海盗湾的交互后解决（但是大副已经被移动了）

**问题**：海盗湾的交互在创建时收集了大副，但是交互解决时大副已经不在海盗湾上了。海盗湾的交互处理器应该检查随从是否仍在基地上，如果不在则跳过。

## 解决方案

### 方案 1：海盗湾的交互处理器检查随从是否仍在基地上

在海盗湾的交互处理器中，检查随从是否仍在基地上。如果不在，则跳过移动。

**优点**：
- 简单直接
- 只需修改海盗湾的交互处理器

**缺点**：
- 需要修改所有类似的交互处理器（如刚柔流寺庙、忍者道场等）
- 不是通用解决方案

### 方案 2：使用动态选项生成（optionsGenerator）

使用 `optionsGenerator` 动态生成选项，确保交互解决时使用最新的状态。

**优点**：
- 通用解决方案
- 已经有框架支持（`autoRefresh` 和 `optionsGenerator`）

**缺点**：
- 需要修改海盗湾的 afterScoring 能力实现

### 方案 3：调整 afterScoring 触发顺序

先触发 ongoing afterScoring（大副），再触发基地的 afterScoring 能力（海盗湾）。

**优点**：
- 避免了时序问题

**缺点**：
- 可能影响其他基地的 afterScoring 能力
- 不符合直觉（基地能力应该先于 ongoing 触发）

## 推荐方案

**方案 2：使用动态选项生成（optionsGenerator）**

这是最通用的解决方案，已经有框架支持。只需要修改海盗湾的 afterScoring 能力实现，使用 `optionsGenerator` 动态生成选项。

## 实现步骤

1. ✅ 修改海盗湾的 afterScoring 能力，使用 `optionsGenerator` 动态生成选项
2. 测试验证修复是否生效
3. 检查其他类似的基地能力（如刚柔流寺庙、忍者道场等），确保它们也使用了动态选项生成

## 修复内容

### 修改文件：`src/games/smashup/domain/baseAbilities.ts`

在海盗湾的 afterScoring 能力中，添加 `optionsGenerator` 动态生成选项：

```typescript
// 【修复】使用 optionsGenerator 动态生成选项，确保交互解决时使用最新状态
// 问题：海盗湾的 afterScoring 能力和大副的 afterScoring 能力都创建了交互
// 如果大副的交互先解决，大副被移动到其他基地，海盗湾的交互选项中仍包含大副
// 解决方案：使用 optionsGenerator 动态生成选项，过滤掉已经不在原基地上的随从
(interaction.data as any).optionsGenerator = (state: any) => {
    const currentBase = state.core?.bases?.[ctx.baseIndex];
    if (!currentBase) return [{ id: 'skip', label: '跳过', value: { skip: true } }];
    
    // 过滤出仍在原基地上的随从
    const stillOnBase = minionsSnapshot.filter(m => 
        currentBase.minions.some((minion: any) => minion.uid === m.uid)
    );
    
    if (stillOnBase.length === 0) {
        // 所有随从都已被移动，只返回"跳过"选项
        return [{ id: 'skip', label: '跳过', value: { skip: true } }];
    }
    
    const refreshedOptions = stillOnBase.map((m, i) => {
        const def = getCardDef(m.defId);
        return {
            id: `minion-${i}`,
            label: `${def?.name ?? m.defId} (力量${m.power})`,
            value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
        };
    });
    
    return [
        { id: 'skip', label: '跳过', value: { skip: true } },
        ...refreshedOptions,
    ];
};
```

### 工作原理

1. **创建交互时**：使用初始选项（基于创建时的状态），包含所有在原基地上的随从
2. **状态更新后**：`refreshInteractionOptions` 检查是否有 `optionsGenerator`
3. **如果有 `optionsGenerator`**：调用它生成新选项，过滤掉已经不在原基地上的随从
4. **弹出交互时**：`resolveInteraction` 同样检查并刷新选项
5. **智能降级**：如果所有随从都已被移动，只返回"跳过"选项

### 效果

- **修复前**：用户需要跳过两次响应（海盗湾的交互和大副的交互）
- **修复后**：如果大副的交互先解决，大副被移动后，海盗湾的交互选项中不再包含大副，只有"跳过"选项

## 测试计划

1. **场景 1**：海盗湾计分，有两个非冠军随从（包括大副）
   - 预期：海盗湾的交互选项包含两个随从
   - 用户先解决大副的交互，大副被移动
   - 预期：海盗湾的交互选项只包含另一个随从

2. **场景 2**：海盗湾计分，只有一个非冠军随从（大副）
   - 预期：海盗湾的交互选项包含大副
   - 用户先解决大副的交互，大副被移动
   - 预期：海盗湾的交互选项只有"跳过"选项

3. **场景 3**：海盗湾计分，有多个非冠军随从（都不是大副）
   - 预期：海盗湾的交互选项包含所有随从
   - 用户解决交互，选择移动一个随从
   - 预期：移动成功

## 相关文件

- `src/games/smashup/domain/baseAbilities.ts` line 974（海盗湾的 afterScoring 能力）
- `src/games/smashup/abilities/pirates.ts` line 42（大副的 afterScoring 能力）
- `src/games/smashup/domain/index.ts` line 245-280（scoreOneBase 函数）
- `src/engine/systems/InteractionSystem.ts`（`refreshInteractionOptions` 和 `resolveInteraction` 函数）

## 教训

1. **多个 afterScoring 能力可能同时触发**：基地的 afterScoring 能力和 ongoing afterScoring 能力都会被触发
2. **交互创建时的状态可能与解决时不同**：如果多个交互都操作同一个实体，后解决的交互可能看到过时的状态
3. **使用 optionsGenerator 动态生成选项**：确保交互解决时使用最新的状态，避免操作已经不存在的实体
4. **智能降级**：如果所有选项都失效了，只返回"跳过"选项，避免交互卡住
