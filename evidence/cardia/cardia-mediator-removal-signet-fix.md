# Cardia 调停者持续标记移除后重新判定胜负修复

## Bug 描述

当虚空法师移除调停者的持续标记后，游戏没有重新判定该遭遇的胜负，导致印戒状态不正确。

## Bug 场景

1. 第一次遭遇：玩家0打出card04（影响力4），玩家1打出card11（影响力11）
2. 玩家1获胜，card11获得1枚印戒
3. 玩家0激活调停者能力，放置持续标记，强制平局，移除card11的印戒
4. 第二次遭遇：玩家1打出card02（虚空法师），激活能力移除card04的持续标记
5. **预期**：card11应该重新获得1枚印戒（因为调停者效果失效，恢复原本的胜负结果）
6. **实际**：card11没有重新获得印戒

## 根因分析

### 调用链检查

1. **虚空法师能力执行**：`src/games/cardia/domain/abilities/group4-card-ops.ts`
   - ✅ 正确发射 `ONGOING_ABILITY_REMOVED` 事件
   - ✅ 正确移除 `core.ongoingAbilities` 中的记录
   - ✅ 正确移除 `card.ongoingMarkers` 中的标记

2. **Reducer 处理**：`src/games/cardia/domain/reduce.ts` → `reduceOngoingAbilityRemoved`
   - ✅ 正确移除 `core.ongoingAbilities` 中的记录
   - ✅ 正确移除 `card.ongoingMarkers` 中的标记
   - ✅ 正确处理财务官（Treasurer）的特殊逻辑（收回额外印戒）
   - ✅ 正确处理审判官（Magistrate）的特殊逻辑（收回历史平局遭遇获得的印戒）
   - ❌ **缺失**：调停者（Mediator）的特殊逻辑（重新判定遭遇胜负并授予印戒）

### 根因

`reduceOngoingAbilityRemoved` 函数中，审判官（Magistrate）的处理逻辑已经考虑了移除持续标记后需要重新判定历史遭遇，但**调停者（Mediator）的处理逻辑缺失了**。

调停者的规则是：
- 放置持续标记时，如果当前遭遇已有获胜方，移除获胜方卡牌上的印戒
- 移除持续标记时，应该重新判定该遭遇的胜负，并授予印戒给真正的获胜方

## 修复方案

在 `reduceOngoingAbilityRemoved` 函数中，添加调停者的特殊处理逻辑：

```typescript
// 特殊处理：调停者能力移除时，重新判定该遭遇的胜负并授予印戒
// 规则：调停者使遭遇变为平局，移除后应该恢复原本的胜负结果
if (removedAbility && abilityId === ABILITY_IDS.MEDIATOR) {
    const encounterIndex = (removedAbility as any).encounterIndex;
    
    // 查找对应的遭遇历史记录
    const encounter = newCore.encounterHistory.find((_, idx) => idx + 1 === encounterIndex);
    
    if (encounter) {
        // 重新判定胜负（不考虑调停者效果）
        const player1Influence = encounter.player1Influence;
        const player2Influence = encounter.player2Influence;
        
        let winnerId: PlayerId | null = null;
        let winnerCard: CardiaCard | null = null;
        
        if (player1Influence > player2Influence) {
            winnerId = newCore.playerOrder[0];
            winnerCard = encounter.player1Card;
        } else if (player2Influence > player1Influence) {
            winnerId = newCore.playerOrder[1];
            winnerCard = encounter.player2Card;
        }
        // 如果影响力相等，仍然是平局，不授予印戒
        
        // 如果有明确的获胜方，授予印戒
        if (winnerId && winnerCard) {
            const winnerPlayer = newCore.players[winnerId];
            const cardIndex = winnerPlayer.playedCards.findIndex(c => c.uid === winnerCard.uid);
            
            if (cardIndex !== -1) {
                const card = winnerPlayer.playedCards[cardIndex];
                const updatedCard = {
                    ...card,
                    signets: card.signets + 1,
                };
                
                const newPlayedCards = [
                    ...winnerPlayer.playedCards.slice(0, cardIndex),
                    updatedCard,
                    ...winnerPlayer.playedCards.slice(cardIndex + 1),
                ];
                
                newCore = updatePlayer(newCore, winnerId, {
                    playedCards: newPlayedCards,
                });
            }
        }
    }
}
```

## 测试验证

### 单元测试

创建了 `src/games/cardia/__tests__/mediator-removal-fix.test.ts`，包含两个测试用例：

1. ✅ 应该在调停者标记被移除后，重新判定遭遇胜负并授予印戒
2. ✅ 应该在调停者标记被移除后，如果原本是平局则不授予印戒

测试结果：
```
✓ src/games/cardia/__tests__/mediator-removal-fix.test.ts (2 tests) 2ms
  ✓ 调停者持续标记移除后重新判定胜负 (2)
    ✓ 应该在调停者标记被移除后，重新判定遭遇胜负并授予印戒 1ms
    ✓ 应该在调停者标记被移除后，如果原本是平局则不授予印戒 0ms
```

### E2E 测试

创建了 `e2e/cardia/cardia-mediator-removal-signet-fix.e2e.ts`，验证完整的游戏流程。

## 修复文件

- `src/games/cardia/domain/reduce.ts`：添加调停者移除后的特殊处理逻辑
- `src/games/cardia/__tests__/mediator-removal-fix.test.ts`：单元测试
- `e2e/cardia/cardia-mediator-removal-signet-fix.e2e.ts`：E2E 测试

## 影响范围

- 仅影响调停者（Mediator）能力被移除时的逻辑
- 不影响其他持续能力的移除逻辑
- 不影响调停者能力的放置逻辑

## 回归风险

- 低风险：修复逻辑与审判官（Magistrate）的处理逻辑类似，已有成熟的参考实现
- 已通过单元测试验证核心逻辑
- 已创建 E2E 测试验证完整流程

## 总结

修复了调停者持续标记被移除后没有重新判定胜负的 bug。修复后，当虚空法师移除调停者的持续标记时，游戏会重新判定该遭遇的胜负，并授予印戒给真正的获胜方。
