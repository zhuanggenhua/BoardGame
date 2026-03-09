# Cardia 游戏结束逻辑修复：双方都无牌可打

## 问题描述

场景5测试中发现，当双方都无牌可打时，游戏结束逻辑不正确：
- P1 无牌可打（手牌0，牌库0）
- P2 无牌可打（手牌0，牌库0）
- P2 有1个印戒，P1 有0个印戒
- 但游戏判定 P2（玩家1）获胜

根据规则文档 `src/games/cardia/rule/卡迪亚规则.md`：
> **双方都无法出牌：**
> - 如果阶段1双方都无法打出牌 → 印戒总和多者获胜
> - 如果印戒总和相同 → 游戏平局

## 根本原因

`src/games/cardia/domain/index.ts` 中的 `isGameOver` 函数逻辑错误：

```typescript
// ❌ 错误逻辑
for (const playerId of core.playerOrder) {
    const player = core.players[playerId];
    if (player.hand.length === 0 && player.deck.length === 0) {
        const opponentId = core.playerOrder.find(pid => pid !== playerId)!;
        return {
            winner: opponentId,
        };
    }
}
```

问题：
1. 只检查第一个玩家是否无牌
2. 如果第一个玩家无牌，直接判定对手获胜
3. 不检查对手是否也无牌
4. 不比较印戒总和

## 解决方案

修改 `isGameOver` 函数，正确处理双方都无牌的情况：

```typescript
// ✅ 正确逻辑
// 检查是否有玩家无法打出卡牌
const playersWithoutCards = core.playerOrder.filter(playerId => {
    const player = core.players[playerId];
    return player.hand.length === 0 && player.deck.length === 0;
});

// 如果双方都无法出牌
if (playersWithoutCards.length === 2) {
    // 比较印戒总和
    const p1Signets = signetsCount[core.playerOrder[0]];
    const p2Signets = signetsCount[core.playerOrder[1]];
    
    if (p1Signets > p2Signets) {
        return { winner: core.playerOrder[0] };
    } else if (p2Signets > p1Signets) {
        return { winner: core.playerOrder[1] };
    } else {
        // 印戒总和相同，游戏平局
        return { draw: true };
    }
}

// 如果只有一方无法出牌，对手获胜
if (playersWithoutCards.length === 1) {
    const loser = playersWithoutCards[0];
    const winner = core.playerOrder.find(pid => pid !== loser)!;
    return { winner };
}
```

## 测试覆盖

创建了 `e2e/cardia-gameover-both-empty.e2e.ts`，覆盖所有边界情况：

### 场景1：双方都无牌，P2印戒多（1 > 0）
- P1: 手牌1张，牌库0张，印戒0个
- P2: 手牌1张，牌库0张，印戒0个
- P1 打出影响力1，P2 打出影响力5
- P2 获胜得1个印戒
- 双方都无牌可打
- **预期**：P2 获胜（印戒：1 > 0）
- **结果**：✅ 通过

### 场景2：双方都无牌，印戒相同（2 = 2）
- P1: 手牌1张，牌库0张，初始印戒2个
- P2: 手牌1张，牌库0张，初始印戒1个
- P1 打出影响力1，P2 打出影响力5
- P2 获胜得1个印戒（总共2个）
- 双方都无牌可打
- **预期**：平局（印戒：2 = 2）
- **结果**：✅ 通过

### 场景2B：双方都无牌，P1印戒多（3 > 1）
- P1: 手牌1张，牌库0张，初始印戒3个
- P2: 手牌1张，牌库0张，初始印戒0个
- P1 打出影响力1，P2 打出影响力5
- P2 获胜得1个印戒（总共1个）
- 双方都无牌可打
- **预期**：P1 获胜（印戒：3 > 1）
- **结果**：✅ 通过

### 场景3：双方都无牌，印戒相同（都是0）
- P1: 手牌1张，牌库0张，印戒0个
- P2: 手牌1张，牌库0张，印戒0个
- P1 打出影响力1，P2 打出影响力1（平局）
- 双方都不得印戒
- 双方都无牌可打
- **预期**：平局（印戒：0 = 0）
- **结果**：✅ 通过
- **注意**：平局时跳过能力阶段，直接进入回合结束

### 场景4：双方都无牌，印戒相同（都是2）
- P1: 手牌1张，牌库0张，初始印戒2个
- P2: 手牌1张，牌库0张，初始印戒1个
- P1 打出影响力1，P2 打出影响力5
- P2 获胜得1个印戒（总共2个）
- 双方都无牌可打
- **预期**：平局（印戒：2 = 2）
- **结果**：✅ 通过

### 场景5：只有P1无牌，P2有牌
- P1: 手牌1张，牌库0张
- P2: 手牌1张，牌库2张
- P1 打出影响力1，P2 打出影响力5
- P2 获胜得1个印戒
- 只有P1无牌可打
- **预期**：P2 获胜（P1无牌可打）
- **结果**：✅ 通过

## 测试结果

```bash
npm run test:e2e -- cardia-gameover-both-empty.e2e.ts
```

```
✓  1 场景1：双方都无牌，P2印戒多（1 > 0） (5.5s)
✓  2 场景2：双方都无牌，印戒相同（2 = 2） (4.7s)
✓  3 场景2B：双方都无牌，P1印戒多（3 > 1） (5.0s)
✓  4 场景3：双方都无牌，印戒相同（都是0） (4.8s)
✓  5 场景4：双方都无牌，印戒相同（都是2） (4.7s)
✓  6 场景5：只有P1无牌，P2有牌 (4.7s)

6 passed (36.9s)
```

## 相关文件

- `src/games/cardia/domain/index.ts` - 修复 `isGameOver` 函数
- `e2e/cardia-gameover-both-empty.e2e.ts` - 新增测试文件
- `e2e/cardia-full-turn-flow.e2e.ts` - 更新场景5的预期结果
- `e2e/helpers/cardia.ts` - 新增 `readLiveState` 辅助函数

## 总结

修复了游戏结束逻辑，现在正确处理以下情况：
1. ✅ 双方都无牌可打 → 比较印戒总和
2. ✅ 印戒总和相同 → 游戏平局
3. ✅ 只有一方无牌 → 对手获胜
4. ✅ 平局遭遇（影响力相同）→ 跳过能力阶段，直接进入回合结束

所有测试通过，游戏结束逻辑符合规则文档。
