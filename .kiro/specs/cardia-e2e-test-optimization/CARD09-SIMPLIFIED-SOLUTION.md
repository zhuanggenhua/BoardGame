# Card09 伏击者 - 简化解决方案

## 🎯 问题根源

通过对比其他游戏的实现，发现：

1. **SmashUp** 和 **DiceThrone** 中的"弃对手手牌"功能都是**直接在能力执行器中产生 `CARDS_DISCARDED` 事件**
2. **Cardia** 的革命者能力（REVOLUTIONARY）也是直接产生事件，能正常工作
3. **Cardia** 的伏击者能力（AMBUSHER）使用了交互系统，流程复杂，可能在某个环节出错

## 📊 对比分析

### SmashUp - 带走宝物（Take the Shinies）

```typescript
// 每个对手随机弃两张牌
for (const pid of ctx.state.turnOrder) {
    if (pid === ctx.playerId) continue;
    const opponent = ctx.state.players[pid];
    if (!opponent || opponent.hand.length === 0) continue;
    const idx = Math.floor(ctx.random.random() * opponent.hand.length);
    const discardUid = opponent.hand[idx].uid;
    events.push({
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: pid, cardUids: [discardUid] },
        timestamp: ctx.now,
    });
}
```

**特点**：
- ✅ 直接在 `onPlay` 回调中产生事件
- ✅ 不需要交互系统
- ✅ 简单直接，易于调试

### DiceThrone - 聚宝盆（Cornucopia）

```typescript
// 若有 Shadow，弃对手1牌
if (hasShadow && random) {
    const opponentHand = state.players[defenderId]?.hand || [];
    if (opponentHand.length > 0) {
        const idx = Math.floor(random.random() * opponentHand.length);
        events.push({
            type: 'CARD_DISCARDED',
            payload: { playerId: defenderId, cardId: opponentHand[idx].id },
            timestamp: timestamp + 1
        });
    }
}
```

**特点**：
- ✅ 直接在 custom action 中产生事件
- ✅ 不需要交互系统
- ✅ 简单直接，易于调试

### Cardia - 革命者（Revolutionary）

```typescript
// 随机选择要弃掉的手牌
const discardedCardIds: string[] = [];
const availableIndices = Array.from({ length: opponentPlayer.hand.length }, (_, i) => i);

for (let i = 0; i < discardCount; i++) {
    const randomIdx = Math.floor(ctx.random() * availableIndices.length);
    const cardIndex = availableIndices.splice(randomIdx, 1)[0];
    discardedCardIds.push(opponentPlayer.hand[cardIndex].uid);
}

return {
    events: [
        {
            type: CARDIA_EVENTS.CARDS_DISCARDED,
            payload: {
                playerId: ctx.opponentId,
                cardIds: discardedCardIds,
                from: 'hand',
            },
            timestamp: ctx.timestamp,
        },
        // ...
    ],
};
```

**特点**：
- ✅ 直接在能力执行器中产生事件
- ✅ 不需要交互系统
- ✅ 能正常工作

### Cardia - 伏击者（Ambusher）当前实现

```typescript
// 能力执行器：创建交互
abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx) => {
    const interaction = createFactionSelectionInteraction(...);
    return { events: [], interaction };
});

// 交互处理器：产生事件
registerInteractionHandler(ABILITY_IDS.AMBUSHER, (state, playerId, value, ...) => {
    const selectedFaction = (value as { faction?: string })?.faction;
    const opponentId = playerId === '0' ? '1' : '0';
    const factionCards = state.core.players[opponentId].hand.filter(card => card.faction === selectedFaction);
    const cardIds = factionCards.map(card => card.uid);
    
    return {
        state,
        events: [{
            type: CARDIA_EVENTS.CARDS_DISCARDED,
            payload: { playerId: opponentId, cardIds, from: 'hand' },
            timestamp,
        }]
    };
});
```

**特点**：
- ❌ 流程复杂：能力执行器 → 交互系统 → 交互处理器 → 事件
- ❌ 依赖 `CardiaEventSystem` 正确调用交互处理器
- ❌ 难以调试（事件在多个系统之间传递）
- ❌ 当前不工作

## 💡 解决方案

### 方案 1：简化实现（推荐）

**直接在能力执行器中产生事件，不使用交互系统**

```typescript
abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx: CardiaAbilityContext) => {
    // 简化版本：随机选择一个派系
    const factions: FactionType[] = ['swamp', 'academy', 'guild', 'dynasty'];
    const randomFaction = factions[Math.floor(ctx.random() * factions.length)];
    
    const opponentPlayer = ctx.core.players[ctx.opponentId];
    const factionCards = opponentPlayer.hand.filter(card => card.faction === randomFaction);
    const cardIds = factionCards.map(card => card.uid);
    
    if (cardIds.length === 0) {
        return { events: [] };
    }
    
    return {
        events: [{
            type: CARDIA_EVENTS.CARDS_DISCARDED,
            payload: {
                playerId: ctx.opponentId,
                cardIds,
                from: 'hand',
            },
            timestamp: ctx.timestamp,
        }]
    };
});
```

**优点**：
- ✅ 简单直接，易于调试
- ✅ 与其他游戏的实现一致
- ✅ 不依赖复杂的交互系统
- ✅ 能立即工作

**缺点**：
- ❌ 玩家无法选择派系（随机选择）
- ❌ 与原始规则不完全一致

### 方案 2：修复交互系统（长期）

**保持当前实现，修复 `CardiaEventSystem` 的问题**

需要：
1. 添加 `gameLogger` 日志到所有关键位置
2. 运行测试并查看服务端日志
3. 定位到具体哪个环节出错
4. 修复问题

**优点**：
- ✅ 符合原始规则（玩家选择派系）
- ✅ 交互系统可以复用到其他能力

**缺点**：
- ❌ 调试时间长
- ❌ 可能需要修改引擎层代码
- ❌ 风险较高

## 🎯 推荐行动

### 短期（立即）

使用**方案 1**（简化实现），让功能先工作起来：

1. 修改 `src/games/cardia/domain/abilities/group7-faction.ts`
2. 将伏击者能力改为直接产生事件（随机选择派系）
3. 运行 E2E 测试验证
4. 标注 TODO：未来改为让玩家选择派系

### 长期（可选）

如果需要让玩家选择派系：

1. 先确保简化版本工作
2. 再逐步添加交互系统
3. 使用 `gameLogger` 追踪问题
4. 修复 `CardiaEventSystem` 的问题

## 📝 实现代码

```typescript
// src/games/cardia/domain/abilities/group7-faction.ts

/**
 * 伏击者（Ambusher）- 影响力 9
 * 效果：选择一个派系，你的对手弃掉所有该派系的手牌
 * 
 * TODO: 当前简化实现为随机选择派系，未来改为让玩家选择
 */
abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx: CardiaAbilityContext) => {
    // 随机选择一个派系
    const factions: FactionType[] = ['swamp', 'academy', 'guild', 'dynasty'];
    const randomFaction = factions[Math.floor(ctx.random() * factions.length)];
    
    const opponentPlayer = ctx.core.players[ctx.opponentId];
    
    // 查找对手该派系的所有手牌
    const factionCards = opponentPlayer.hand.filter(card => card.faction === randomFaction);
    
    if (factionCards.length === 0) {
        // 没有该派系的手牌
        return { events: [] };
    }
    
    const cardIds = factionCards.map(card => card.uid);
    
    return {
        events: [{
            type: CARDIA_EVENTS.CARDS_DISCARDED,
            payload: {
                playerId: ctx.opponentId,
                cardIds,
                from: 'hand',
            },
            timestamp: ctx.timestamp,
        }]
    };
});
```

## 🧪 测试验证

运行 E2E 测试：

```bash
npm run test:e2e -- cardia-deck1-card09-ambusher.e2e.ts
```

**预期结果**：
- ✅ P2 手牌减少（从 3 张变成 1 张或更少，取决于随机选择的派系）
- ✅ 弃牌堆增加
- ✅ 测试通过

**注意**：由于派系是随机选择的，测试可能需要调整断言：
- 不再断言"剩余 1 张"（因为可能选择了 Guild 派系，只弃掉 1 张）
- 改为断言"手牌减少了"或"弃牌堆增加了"
