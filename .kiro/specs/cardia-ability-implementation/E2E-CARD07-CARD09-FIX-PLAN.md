# Card07 (Court Guard) 和 Card09 (Ambusher) E2E 测试修复方案

## 问题分析

### 当前状态
- ✅ Card07 (court-guard) 和 Card09 (ambusher) 的 executor 已注册
- ✅ 测试能够激活能力按钮
- ❌ 测试超时等待派系选择弹窗（`.fixed.inset-0.z-50`）

### 根本原因
两个能力的 executor 实现使用了**简化版本**（自动选择派系），没有创建交互让玩家选择派系：

**当前实现（错误）**：
```typescript
// COURT_GUARD - 自动选择派系
abilityExecutorRegistry.register(ABILITY_IDS.COURT_GUARD, (ctx) => {
    const selectedFaction = ctx.selectedFaction || 'swamp'; // ❌ 自动选择
    // ... 直接执行逻辑
});

// AMBUSHER - 自动选择派系
abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx) => {
    const selectedFaction: FactionType = FACTION_IDS.SWAMP; // ❌ 硬编码
    // ... 直接执行逻辑
});
```

**正确实现（参考 SURGEON）**：
```typescript
// SURGEON - 创建交互
abilityExecutorRegistry.register(ABILITY_IDS.SURGEON, (ctx) => {
    const interaction = createCardSelectionInteraction(...);
    return { events: [], interaction }; // ✅ 返回交互
});

// 注册交互处理函数
registerInteractionHandler(ABILITY_IDS.SURGEON, (state, playerId, value, ...) => {
    // 玩家选择后执行逻辑
});
```

## 修复方案

### 1. 更新 COURT_GUARD Executor

**文件**: `src/games/cardia/domain/abilities/group2-modifiers.ts`

**修改点 1**: 更新 executor 创建交互
```typescript
/**
 * 宫廷卫士（Court Guard）- 影响力 7
 * 效果：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
 */
abilityExecutorRegistry.register(ABILITY_IDS.COURT_GUARD, (ctx: CardiaAbilityContext) => {
    // 创建派系选择交互
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.playerId,
        '选择派系',
        '选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力'
    );
    
    return {
        events: [],
        interaction,
    };
});
```

**修改点 2**: 注册交互处理函数（在文件末尾的 `registerModifierInteractionHandlers` 函数中）
```typescript
export function registerModifierInteractionHandlers(): void {
    // ... 其他 handler ...
    
    // 宫廷卫士：选择派系后，对手选择是否弃牌
    registerInteractionHandler(ABILITY_IDS.COURT_GUARD, (state, playerId, value, interactionData, _random, timestamp) => {
        const selectedFaction = (value as { faction?: string })?.faction;
        if (!selectedFaction) {
            return undefined;
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponentPlayer = state.core.players[opponentId];
        
        // 查找对手该派系的手牌
        const factionCards = opponentPlayer.hand.filter(card => card.faction === selectedFaction);
        
        const events: CardiaEvent[] = [];
        
        // 获取当前卡牌 ID（从 interactionData 中）
        const cardId = (interactionData as any)?.cardId;
        
        if (factionCards.length > 0) {
            // 对手有该派系手牌，弃掉第一张（简化版本）
            // TODO: 让对手选择是否弃牌
            events.push({
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: opponentId,
                    cardIds: [factionCards[0].uid],
                    from: 'hand',
                },
                timestamp,
            });
        } else {
            // 对手没有该派系手牌，本牌添加+7影响力
            events.push({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId,
                    value: 7,
                    source: ABILITY_IDS.COURT_GUARD,
                    timestamp,
                },
                timestamp,
            });
        }
        
        return { state, events };
    });
}
```

### 2. 更新 AMBUSHER Executor

**文件**: `src/games/cardia/domain/abilities/group7-faction.ts`

**修改点 1**: 更新 executor 创建交互
```typescript
/**
 * 伏击者（Ambusher）- 影响力 9
 * 效果：选择一个派系，你的对手弃掉所有该派系的手牌
 */
abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx: CardiaAbilityContext) => {
    // 创建派系选择交互
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.playerId,
        '选择派系',
        '选择一个派系，你的对手弃掉所有该派系的手牌'
    );
    
    return {
        events: [],
        interaction,
    };
});
```

**修改点 2**: 注册交互处理函数（在文件末尾添加）
```typescript
/**
 * 注册派系相关能力的交互处理函数
 */
export function registerFactionInteractionHandlers(): void {
    // 伏击者：选择派系后，对手弃掉所有该派系的手牌
    registerInteractionHandler(ABILITY_IDS.AMBUSHER, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedFaction = (value as { faction?: string })?.faction;
        if (!selectedFaction) {
            return undefined;
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponentPlayer = state.core.players[opponentId];
        
        // 查找对手该派系的所有手牌
        const factionCards = opponentPlayer.hand.filter(card => card.faction === selectedFaction);
        
        if (factionCards.length === 0) {
            return { state, events: [] };
        }
        
        const cardIds = factionCards.map(card => card.uid);
        
        const events: CardiaEvent[] = [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: opponentId,
                    cardIds,
                    from: 'hand',
                },
                timestamp,
            }
        ];
        
        return { state, events };
    });
    
    // 巫王：选择派系后，对手从手牌和牌库弃掉所有该派系的牌
    registerInteractionHandler(ABILITY_IDS.WITCH_KING, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedFaction = (value as { faction?: string })?.faction;
        if (!selectedFaction) {
            return undefined;
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponentPlayer = state.core.players[opponentId];
        
        // 查找对手手牌中该派系的所有卡牌
        const handFactionCards = opponentPlayer.hand.filter(card => card.faction === selectedFaction);
        const handCardIds = handFactionCards.map(card => card.uid);
        
        // 查找对手牌库中该派系的所有卡牌
        const deckFactionCards = opponentPlayer.deck.filter(card => card.faction === selectedFaction);
        const deckCardIds = deckFactionCards.map(card => card.uid);
        
        const events: CardiaEvent[] = [];
        
        // 弃掉手牌中该派系的卡牌
        if (handCardIds.length > 0) {
            events.push({
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: opponentId,
                    cardIds: handCardIds,
                    from: 'hand',
                },
                timestamp,
            });
        }
        
        // 弃掉牌库中该派系的卡牌
        if (deckCardIds.length > 0) {
            events.push({
                type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                payload: {
                    playerId: opponentId,
                    count: deckCardIds.length,
                },
                timestamp,
            });
        }
        
        // 混洗牌库
        events.push({
            type: CARDIA_EVENTS.DECK_SHUFFLED,
            payload: {
                playerId: opponentId,
            },
            timestamp,
        });
        
        return { state, events };
    });
}
```

### 3. 更新 WITCH_KING Executor

**文件**: `src/games/cardia/domain/abilities/group7-faction.ts`

**修改点**: 更新 executor 创建交互
```typescript
/**
 * 巫王（Witch King）- 影响力 13（II 牌组）
 * 效果：选择一个派系，你的对手从手牌和牌库弃掉所有该派系的牌，然后混洗他的牌库
 */
abilityExecutorRegistry.register(ABILITY_IDS.WITCH_KING, (ctx: CardiaAbilityContext) => {
    // 创建派系选择交互
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.playerId,
        '选择派系',
        '选择一个派系，你的对手从手牌和牌库弃掉所有该派系的牌，然后混洗他的牌库'
    );
    
    return {
        events: [],
        interaction,
    };
});
```

### 4. 确保交互处理函数被调用

**文件**: `src/games/cardia/domain/abilities/group7-faction.ts`

在文件末尾添加导出：
```typescript
// 导出注册函数
export { registerFactionInteractionHandlers };
```

**文件**: `src/games/cardia/domain/abilityExecutor.ts`

在 `initializeAbilityExecutors` 函数中调用注册函数：
```typescript
export async function initializeAbilityExecutors(): Promise<void> {
    await import('./abilities/group1-resources');
    await import('./abilities/group2-modifiers');
    await import('./abilities/group3-ongoing');
    await import('./abilities/group4-card-ops');
    await import('./abilities/group5-copy');
    await import('./abilities/group6-special');
    await import('./abilities/group7-faction');
    
    // 注册交互处理函数
    const { registerModifierInteractionHandlers } = await import('./abilities/group2-modifiers');
    const { registerFactionInteractionHandlers } = await import('./abilities/group7-faction');
    
    registerModifierInteractionHandlers();
    registerFactionInteractionHandlers();
}
```

### 5. 添加必要的 Import

**文件**: `src/games/cardia/domain/abilities/group2-modifiers.ts`

在文件顶部添加：
```typescript
import { createFactionSelectionInteraction } from '../interactionHandlers';
import type { CardiaEvent } from '../core-types';
```

**文件**: `src/games/cardia/domain/abilities/group7-faction.ts`

在文件顶部添加：
```typescript
import { createFactionSelectionInteraction } from '../interactionHandlers';
import { registerInteractionHandler } from '../abilityInteractionHandlers';
import type { CardiaEvent } from '../core-types';
```

## 预期结果

修复后：
1. ✅ 激活 COURT_GUARD 能力后，显示派系选择弹窗
2. ✅ 选择派系后，根据对手手牌情况执行逻辑（弃牌或+7影响力）
3. ✅ 激活 AMBUSHER 能力后，显示派系选择弹窗
4. ✅ 选择派系后，对手弃掉所有该派系的手牌
5. ✅ Card07 和 Card09 E2E 测试通过

## 测试验证

运行测试：
```bash
npx playwright test e2e/cardia-deck1-card07-court-guard.e2e.ts
npx playwright test e2e/cardia-deck1-card09-ambusher.e2e.ts
```

预期：
- Card07 测试通过（派系选择弹窗出现）
- Card09 测试通过（派系选择弹窗出现）

## 注意事项

1. **交互 ID 格式**: 使用 `${abilityId}_${timestamp}` 确保唯一性
2. **交互数据传递**: `interactionData` 中需要包含 `cardId`（当前卡牌）
3. **对手 ID 计算**: `opponentId = playerId === '0' ? '1' : '0'`
4. **简化实现**: 当前对手弃牌逻辑是简化版本（自动弃第一张），未来可以添加对手选择交互
5. **事件类型**: 使用 `CARDIA_EVENTS.CARDS_DISCARDED` 和 `CARDIA_EVENTS.MODIFIER_TOKEN_PLACED`

## 相关文件

- `src/games/cardia/domain/abilities/group2-modifiers.ts` - COURT_GUARD executor
- `src/games/cardia/domain/abilities/group7-faction.ts` - AMBUSHER 和 WITCH_KING executor
- `src/games/cardia/domain/interactionHandlers.ts` - 交互创建函数
- `src/games/cardia/domain/abilityInteractionHandlers.ts` - 交互处理函数注册表
- `src/games/cardia/domain/abilityExecutor.ts` - executor 初始化
- `e2e/cardia-deck1-card07-court-guard.e2e.ts` - Card07 测试
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - Card09 测试
