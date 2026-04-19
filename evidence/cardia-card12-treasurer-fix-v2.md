# Cardia Card12 财务官能力修复（最终版本）

## 问题描述

财务官（card12，影响力 12）的能力"上个遭遇获胜的牌额外获得1枚印戒"不生效。

## 能力语义澄清

**财务官**：🔄 上个遭遇获胜的那张牌额外获得1枚印戒

**正确理解**：
- 无论当前遭遇谁获胜
- 无论上一个遭遇谁获胜
- 只要有遭遇结算，就给**上一个遭遇的获胜卡牌**额外印戒

**错误理解**（之前的实现）：
- 只有当上一个遭遇是财务官玩家获胜时才触发

## 用户报告的场景

### 场景状态
- 回合 3：P1 打出女导师（14），P2 打出财务官（12），P1 获胜
  - P2 激活财务官能力（持续标记已放置）
- 回合 4：下一个遭遇结算

### 关键状态数据
```json
{
  "previousEncounter": {
    "winnerId": "0",  // P1 获胜
    "player1Card": { "defId": "deck_i_card_14" },  // 女导师
    "player2Card": { "defId": "deck_i_card_12" }   // 财务官
  },
  "ongoingAbilities": [
    {
      "abilityId": "ability_i_treasurer",
      "playerId": "1",  // P2
      "effectType": "extraSignet"
    }
  ]
}
```

### 预期行为（修复后）

回合 4 遭遇结算时：
- 财务官能力触发
- 女导师（上一个遭遇的获胜卡牌）额外获得 1 枚印戒
- 财务官能力被移除（一次性效果）

## 根因分析

### 第一次错误实现

```typescript
if (ability.playerId === winner) {
    // 只有当前遭遇获胜者 = 财务官玩家时才检查
    ...
}
```

**问题**：要求当前遭遇的获胜者必须是财务官玩家。

### 第二次错误实现（第一次修复）

```typescript
if (previousEncounter && previousEncounter.winnerId === ability.playerId) {
    // 只有上一个遭遇获胜者 = 财务官玩家时才触发
    ...
}
```

**问题**：要求上一个遭遇的获胜者必须是财务官玩家。

### 正确实现（第二次修复）

```typescript
if (previousEncounter && previousEncounter.winnerId && previousEncounter.winnerId !== 'tie') {
    // 无论谁获胜，都给上一个遭遇的获胜卡牌额外印戒
    const previousWinnerCard = previousEncounter.winnerId === previousEncounter.player1Card?.ownerId
        ? previousEncounter.player1Card
        : previousEncounter.player2Card;
    
    if (previousWinnerCard) {
        events.push({
            type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED,
            timestamp: Date.now(),
            payload: {
                cardId: previousWinnerCard.uid,
                playerId: previousEncounter.winnerId,  // 使用上一个遭遇的获胜者
            },
        });
    }
}
```

**关键变更**：
1. 移除了 `previousEncounter.winnerId === ability.playerId` 的条件
2. 只检查上一个遭遇是否有获胜者（不是平局）
3. `playerId` 使用 `previousEncounter.winnerId`，而不是 `ability.playerId`

## 修复内容

### 代码变更

文件：`src/games/cardia/domain/execute.ts`

**修复前**：
```typescript
if (previousEncounter && previousEncounter.winnerId === ability.playerId) {
    // 只有上一个遭遇是财务官玩家获胜时才触发
    ...
    payload: {
        cardId: previousWinnerCard.uid,
        playerId: ability.playerId,  // 错误：使用财务官玩家的 ID
    }
}
```

**修复后**：
```typescript
if (previousEncounter && previousEncounter.winnerId && previousEncounter.winnerId !== 'tie') {
    // 无论谁获胜，都给上一个遭遇的获胜卡牌额外印戒
    ...
    payload: {
        cardId: previousWinnerCard.uid,
        playerId: previousEncounter.winnerId,  // 正确：使用上一个遭遇获胜者的 ID
    }
}
```

## 测试验证

### E2E 测试

文件：`e2e/cardia-card12-debug.e2e.ts`

**测试场景**：
1. 初始状态：
   - 第 3 回合已结束：P1 打出女导师（14），P2 打出财务官（12），P1 获胜
   - 女导师有 1 个印戒
   - P2 已激活财务官能力（持续标记已放置）
   - `previousEncounter` 指向第 3 回合（P1 获胜）

2. 测试流程：
   - 第 4 回合：P2 打出占卜师（6），P1 打出宫廷卫士（7）
   - P1 获胜（当前遭遇）

3. 预期结果：
   - 女导师（上一个遭遇的获胜卡牌）获得额外印戒 → **总共 2 枚**
   - 财务官能力被移除（一次性效果）

### 测试结果

```
=== 初始状态 ===
已注入 previousEncounter: {
  winnerId: '0',
  player1Card: 'deck_i_card_14 (女导师)',
  player2Card: 'deck_i_card_12 (财务官)'
}

P1 playedCards (before): [
  { defId: 'deck_i_card_14', signets: 1 }  // 女导师：1 枚印戒
]

=== 遭遇结算后 ===
P1 playedCards (after): [
  { defId: 'deck_i_card_14', signets: 2 },  // 女导师：2 枚印戒 ✅
  { defId: 'deck_i_card_07', signets: 1 }   // 宫廷卫士：1 枚印戒
]

✅ 验证通过：女导师（上一个遭遇的获胜卡牌）获得了额外印戒
✅ 财务官能力已被移除（一次性效果）
```

**测试命令**：
```bash
BG_HEAVY_MEMORY_MIN_FREE_GB=0.1 npm run test:e2e -- cardia-card12-debug.e2e.ts
```

**测试时间**：11.7 秒

## 能力对比

| 能力 | 描述 | 触发条件 | 目标卡牌 |
|------|------|----------|----------|
| **财务官** (I 牌组) | 🔄 上个遭遇获胜的牌额外获得1枚印戒 | 下一个遭遇结算时（无论谁获胜） | 上一个遭遇的获胜卡牌（无论谁的） |
| **顾问** (II 牌组) | 🔄 你赢的上一次遭遇，即使是平局 | 放置标记的玩家获胜时 | 当前遭遇的获胜卡牌（自己的） |

**关键区别**：
- 财务官：给**上一个遭遇**的获胜卡牌额外印戒（可能是对手的卡）
- 顾问：给**当前遭遇**的获胜卡牌额外印戒（一定是自己的卡）

## 总结

✅ 已修复财务官能力的触发条件
✅ E2E 测试通过，验证能力正常工作
✅ 代码逻辑符合能力描述的语义

**修复要点**：
1. 移除了"上一个遭遇必须是财务官玩家获胜"的错误条件
2. 只要上一个遭遇有获胜者（不是平局），就给该获胜卡牌额外印戒
3. 使用上一个遭遇获胜者的 `playerId`，而不是财务官玩家的 `playerId`

**用户报告场景的解释**：在用户提供的场景中，财务官能力**应该触发**，给女导师（上一个遭遇的获胜卡牌）额外印戒，即使女导师是对手的卡牌。修复后，这个场景现在可以正常工作了。
