# SmashUp 刚柔流寺庙 afterScoring 交互缺少快照

## 问题描述

刚柔流寺庙（base_temple_of_goju）的 afterScoring 能力在创建交互时，没有保存随从信息快照，导致交互解决时可能找不到随从。

## 根因分析

### 刚柔流寺庙能力

"在这个基地计分后，将每位玩家在这里力量最高的一张随从放入他们拥有者的牌库底"

### 问题

1. **创建交互时**：随从仍在基地上，`first.candidates` 包含完整的 `MinionOnBase` 对象
2. **BASE_CLEARED 事件**：所有随从被移除，进入弃牌堆
3. **交互解决时**：`continuationContext` 中只保存了 `{ uid, defId, owner }`，没有保存 `power` 等信息
4. **链式交互**：如果有多个玩家需要平局选择，后续交互的选项生成依赖于 `candidateUids`，但这些 uid 对应的随从可能已经不在基地上

### 与母舰基地的对比

母舰基地已经正确实现了快照机制：

```typescript
const minionsSnapshot = eligible.map(m => ({
    uid: m.uid,
    defId: m.defId,
    power: getEffectivePower(ctx.state, m, ctx.baseIndex),
}));
```

刚柔流寺庙缺少类似的快照机制。

## 修复方案

### 修改 `registerBaseAbility('base_temple_of_goju', 'afterScoring')`

在创建交互时，保存所有候选随从的快照：

```typescript
// 保存随从快照（包括第一个玩家和剩余玩家的所有候选随从）
const firstCandidatesSnapshot = first.candidates.map(m => ({
    uid: m.uid,
    defId: m.defId,
    owner: m.owner,
    power: getEffectivePower(ctx.state, m, ctx.baseIndex),
}));

const options = firstCandidatesSnapshot.map(m => {
    const def = getCardDef(m.defId) as MinionCardDef | undefined;
    const name = def?.name ?? m.defId;
    return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${m.power})` };
});

const remainingData = remaining.map(tb => ({
    playerId: tb.playerId,
    // 保存每个玩家的候选随从快照
    candidateUids: tb.candidates.map(c => ({ 
        uid: c.uid, 
        defId: c.defId, 
        owner: c.owner,
        power: getEffectivePower(ctx.state, c, ctx.baseIndex),
    })),
    maxPower: tb.maxPower,
}));

return { events, matchState: queueInteraction(ctx.matchState, {
    ...interaction,
    data: { 
        ...interaction.data, 
        continuationContext: { 
            baseIndex: ctx.baseIndex, 
            remainingPlayers: remainingData,
            // 保存第一个玩家的候选随从快照
            firstCandidatesSnapshot,
        },
    },
}) };
```

### 为什么需要快照

1. **BASE_CLEARED 延迟**：afterScoring 交互创建后，BASE_CLEARED 事件被延迟到所有交互解决后才发出
2. **链式交互**：刚柔流寺庙可能创建多个链式交互（每个有平局的玩家一个）
3. **状态变化**：在链式交互解决过程中，随从可能被其他交互移动或消灭
4. **选项生成**：后续交互的选项生成依赖于快照，而不是当前状态

## 测试建议

### E2E 测试场景

1. **单玩家平局**：
   - 玩家 A 在刚柔流寺庙有 2 个力量相同的最高力量随从
   - 玩家 A 选择其中一个放入牌库底
   - 验证选中的随从进入牌库底，另一个进入弃牌堆

2. **多玩家平局**：
   - 玩家 A 和玩家 B 各有 2 个力量相同的最高力量随从
   - 玩家 A 先选择，玩家 B 后选择
   - 验证两个玩家的选择都正确执行

3. **链式交互 + 其他 afterScoring**：
   - 刚柔流寺庙 + 大图书馆同时触发
   - 验证两个交互都正常工作
   - 验证 BASE_CLEARED 事件在所有交互解决后才发出

## 相关文件

- `src/games/smashup/domain/baseAbilities.ts` - 刚柔流寺庙能力定义
- `docs/bugs/smashup-afterscoring-summary.md` - afterScoring 问题总结
- `docs/bugs/smashup-mothership-afterscoring.md` - 母舰基地类似问题（已修复）

## 教训

1. **afterScoring 交互必须保存快照**：因为 BASE_CLEARED 事件被延迟，但其他交互可能会修改基地状态
2. **链式交互尤其需要快照**：后续交互的选项生成依赖于快照，而不是当前状态
3. **参考现有实现**：母舰基地和海盗湾已经有正确的实现，新增类似功能时应该参考
4. **全面排查**：用户报告"所有基地都有问题"时，需要全面排查所有类似实现
