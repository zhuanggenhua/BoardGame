# Cardia Card12 财务官能力修复 - 持续标记 + 即时生效 + 虚空法师移除

## 问题描述

用户期望：
- **第2回合**：p1 的 card14 获胜
- **第3回合**：p1 的 card12（财务官）失败，激活能力
- **第3回合结算时**：财务官能力应该立即触发，给**第2回合 p1 的 card14**额外印戒
- **虚空法师移除持续标记时**：第2回合 p1 的 card14 的额外印戒应该被移除

当前实现（修复前）：
- **第3回合**：财务官激活，放置持续标记
- **第4回合遭遇结算时**：财务官能力才触发，给**第3回合的获胜卡牌**额外印戒

## 能力语义澄清

**财务官**：🔄 上个遭遇获胜的牌额外获得1枚印戒

**关键问题**："上个遭遇"是指：
1. **财务官激活时的上一个遭遇**（第2回合）← 用户期望 ✅
2. **财务官能力触发时的上一个遭遇**（第3回合）← 当前实现 ❌

**虚空法师移除规则**：
- 当虚空法师移除财务官的持续标记时，财务官能力产生的额外印戒也应该被移除
- 这需要在持续标记中记录目标卡牌信息（`targetCardId` 和 `targetPlayerId`）

## 修复方案

保持持续标记机制，但让效果立即生效，并支持虚空法师移除：

1. **激活时**：放置持续标记（记录目标卡牌信息）+ 立即发射 `EXTRA_SIGNET_PLACED` 事件
2. **虚空法师移除时**：从目标卡牌上移除额外印戒（通过 `targetCardId` 和 `targetPlayerId` 定位）

### 修复前

```typescript
// group3-ongoing.ts
abilityExecutorRegistry.register(ABILITY_IDS.TREASURER, (ctx: CardiaAbilityContext) => {
    // 只放置持续标记，效果在下次遭遇结算时应用
    return {
        events: [
            {
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
                payload: {
                    abilityId: ctx.abilityId,
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    effectType: 'extraSignet',
                    timestamp: ctx.timestamp,
                    encounterIndex: ctx.core.turnNumber,
                    // ❌ 缺少 targetCardId 和 targetPlayerId
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});
```

### 修复后

```typescript
// group3-ongoing.ts
abilityExecutorRegistry.register(ABILITY_IDS.TREASURER, (ctx: CardiaAbilityContext) => {
    const events: any[] = [];
    
    // 2. 立即检查上一个遭遇的获胜卡牌并给予额外印戒
    const previousEncounter = ctx.core.previousEncounter;
    
    let targetCardId: string | undefined;
    let targetPlayerId: string | undefined;
    
    if (previousEncounter && previousEncounter.winnerId && previousEncounter.winnerId !== 'tie') {
        const previousWinnerCard = previousEncounter.winnerId === previousEncounter.player1Card?.ownerId
            ? previousEncounter.player1Card
            : previousEncounter.player2Card;
        
        if (previousWinnerCard) {
            targetCardId = previousWinnerCard.uid;
            targetPlayerId = previousEncounter.winnerId;
            
            // 立即给上一个遭遇的获胜卡牌额外印戒
            events.push({
                type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED,
                timestamp: ctx.timestamp,
                payload: {
                    cardId: previousWinnerCard.uid,
                    playerId: previousEncounter.winnerId,
                },
            });
        }
    }
    
    // 1. 放置持续标记（保持持续能力的语义）
    // ✅ 记录目标卡牌信息，以便虚空法师移除时能收回额外印戒
    events.push({
        type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
        payload: {
            abilityId: ctx.abilityId,
            cardId: ctx.cardId,
            playerId: ctx.playerId,
            effectType: 'extraSignet',
            timestamp: ctx.timestamp,
            encounterIndex: ctx.core.turnNumber,
            targetCardId,  // ✅ 记录目标卡牌 UID
            targetPlayerId, // ✅ 记录目标玩家 ID
        },
        timestamp: ctx.timestamp,
    });
    
    return { events };
});

// reduce.ts - reduceOngoingAbilityRemoved 函数中
function reduceOngoingAbilityRemoved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.ONGOING_ABILITY_REMOVED }>
): CardiaCore {
    const { abilityId, cardId, playerId } = event.payload;
    
    // 查找被移除的持续能力（用于获取 targetCardId 和 targetPlayerId）
    const removedAbility = core.ongoingAbilities.find(
        ability => ability.abilityId === abilityId && ability.cardId === cardId
    );
    
    // ... 移除持续标记的逻辑 ...
    
    // ✅ 特殊处理：财务官能力移除时，收回额外印戒
    if (removedAbility && abilityId === ABILITY_IDS.TREASURER) {
        const targetCardId = (removedAbility as any).targetCardId;
        const targetPlayerId = (removedAbility as any).targetPlayerId;
        
        if (targetCardId && targetPlayerId) {
            const targetPlayer = newCore.players[targetPlayerId];
            const targetCardIndex = targetPlayer.playedCards.findIndex(c => c.uid === targetCardId);
            
            if (targetCardIndex !== -1) {
                const targetCard = targetPlayer.playedCards[targetCardIndex];
                
                // 只有当卡牌还有印戒时才减少
                if (targetCard.signets > 0) {
                    const updatedTargetCard = {
                        ...targetCard,
                        signets: targetCard.signets - 1,
                    };
                    
                    const newTargetPlayedCards = [
                        ...targetPlayer.playedCards.slice(0, targetCardIndex),
                        updatedTargetCard,
                        ...targetPlayer.playedCards.slice(targetCardIndex + 1),
                    ];
                    
                    newCore = updatePlayer(newCore, targetPlayerId, {
                        playedCards: newTargetPlayedCards,
                    });
                }
            }
        }
    }
    
    return newCore;
}
```

## 修改文件

1. `src/games/cardia/domain/abilities/group3-ongoing.ts`
   - 修改财务官能力执行器
   - 先检查上一个遭遇的获胜卡牌并立即发射 `EXTRA_SIGNET_PLACED` 事件
   - 然后放置持续标记，**记录 `targetCardId` 和 `targetPlayerId`**

2. `src/games/cardia/domain/reduce.ts`
   - `reduceOngoingAbilityRemoved` 函数已有财务官特殊处理逻辑
   - 当虚空法师移除财务官持续标记时，自动从目标卡牌上移除额外印戒

## 行为变化

### 修复前

| 回合 | 事件 | 财务官能力状态 | 印戒变化 |
|------|------|----------------|----------|
| 2 | P1 card14 获胜 | - | card14: 0 → 1 |
| 3 | P1 card12 失败，激活财务官 | 放置持续标记（无目标信息） | 无 ❌ |
| 4 | 遭遇结算 | 触发能力，给第3回合获胜卡牌额外印戒 | 第3回合获胜卡牌: +1 ❌ |
| 5 | 虚空法师移除持续标记 | 移除标记 | 无法收回额外印戒 ❌ |

### 修复后

| 回合 | 事件 | 财务官能力状态 | 印戒变化 |
|------|------|----------------|----------|
| 2 | P1 card14 获胜 | - | card14: 0 → 1 |
| 3 | P1 card12 失败，激活财务官 | 放置持续标记（记录 card14 为目标）+ 立即生效 | card14: 1 → 2 ✅ |
| 4 | 虚空法师移除持续标记 | 移除标记 + 收回额外印戒 | card14: 2 → 1 ✅ |

## 关键设计

### 为什么要保持持续标记？

1. **语义一致性**：🔄 符号表示持续能力，应该有持续标记
2. **可被虚空法师移除**：持续标记可以被虚空法师的能力移除，移除后额外印戒也被收回
3. **状态可观测性**：UI 可以显示财务官能力已激活（通过 `ongoingMarkers`）
4. **持续存在**：持续标记保持到游戏结束（除非被虚空法师移除）

### 为什么效果要立即生效？

1. **用户期望**："上个遭遇"指的是"激活时的上一个遭遇"，而不是"下次遭遇结算时的上一个遭遇"
2. **语义清晰**：避免"上个遭遇"的歧义
3. **行为直观**：激活能力后立即看到效果，而不是等到下一个遭遇

### 为什么要记录目标卡牌信息？

1. **虚空法师移除规则**：当虚空法师移除财务官的持续标记时，额外印戒应该被收回
2. **精确定位**：通过 `targetCardId` 和 `targetPlayerId` 精确定位需要移除印戒的卡牌
3. **一致性**：与审判官、调停者的移除逻辑保持一致（移除持续标记时回滚效果）

## 测试验证

需要更新以下测试：

1. `e2e/cardia/cardia-deck1-card12-treasurer.e2e.ts`
   - 验证财务官能力在激活时立即生效
   - 验证给上一个遭遇的获胜卡牌额外印戒
   - 验证虚空法师移除持续标记时，额外印戒被收回

2. `src/games/cardia/__tests__/abilities-group3-ongoing.test.ts`
   - 验证财务官能力同时发射 `ONGOING_ABILITY_PLACED` 和 `EXTRA_SIGNET_PLACED` 事件
   - 验证持续标记包含 `targetCardId` 和 `targetPlayerId` 字段

3. `src/games/cardia/__tests__/void-mage-treasurer-interaction.test.ts`（新增）
   - 验证虚空法师移除财务官持续标记时，额外印戒被收回

## 总结

✅ 保持持续标记机制（符合 🔄 持续能力的语义）
✅ 效果立即生效（在激活时立即给上一个遭遇的获胜卡牌额外印戒）
✅ 持续标记保持到游戏结束（除非被虚空法师移除）
✅ 虚空法师移除时收回额外印戒（通过 `targetCardId` 和 `targetPlayerId` 定位）
✅ 符合用户期望的行为

**关键变更**：
- 财务官能力在激活时先立即发射额外印戒事件，再放置持续标记
- 持续标记记录 `targetCardId` 和 `targetPlayerId`，以便虚空法师移除时能收回额外印戒
- "上个遭遇"指的是"财务官激活时的上一个遭遇"
- 虚空法师移除持续标记时，reducer 自动从目标卡牌上移除额外印戒
