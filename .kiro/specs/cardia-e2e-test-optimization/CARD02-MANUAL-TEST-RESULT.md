# Card02 虚空法师 - 手动测试结果分析

## 测试执行情况

✅ **能力激活成功**：虚空法师能力正确触发
✅ **弹窗正确显示**：显示了两张有标记的卡牌（P1 外科医生、P2 审判官）
✅ **玩家选择**：选择了 P2 的审判官（`p2_played_judge`）

## 关键事件流

### Event 47-48: 虚空法师能力激活
```json
{
  "id": 47,
  "event": {
    "type": "cardia:ability_activated",
    "payload": {
      "abilityId": "ability_i_void_mage",
      "cardId": "p1_hand_void_mage",
      "playerId": "0"
    }
  }
}
```

### Event 48: 交互请求创建
```json
{
  "id": 48,
  "event": {
    "type": "cardia:ability_interaction_requested",
    "payload": {
      "interaction": {
        "type": "card_selection",
        "availableCards": ["p1_played_surgeon", "p2_played_judge"],  // ✅ 两张卡牌都检测到了
        "minSelect": 1,
        "maxSelect": 1
      }
    }
  }
}
```

### Event 53: 交互解决
```json
{
  "id": 53,
  "event": {
    "type": "SYS_INTERACTION_RESOLVED",
    "payload": {
      "optionId": "card_p2_played_judge",  // ✅ 选择了审判官
      "value": {
        "cardUid": "p2_played_judge"
      }
    }
  }
}
```

## 问题分析：标记未被移除 ❌

### 当前状态检查

**P2 审判官的状态**：
```json
{
  "uid": "p2_played_judge",
  "defId": "deck_i_card_08",
  "ongoingMarkers": ["ability_i_judge"],  // ❌ 持续标记仍然存在
  "encounterIndex": 0
}
```

**全局持续能力列表**：
```json
"ongoingAbilities": [
  {
    "abilityId": "ability_i_judge",
    "cardId": "p2_played_judge",  // ❌ 持续能力仍然存在
    "playerId": "1"
  }
]
```

**全局修正标记列表**：
```json
"modifierTokens": [
  {
    "cardId": "p1_played_surgeon",
    "value": 5,
    "source": "ability_i_inventor"
  },
  {
    "cardId": "p2_played_judge",  // ❌ 修正标记仍然存在
    "value": -3,
    "source": "ability_i_inventor"
  }
]
```

## 根本原因

**交互解决后没有触发标记移除逻辑**

从事件流可以看到：
1. ✅ Event 47: 能力激活
2. ✅ Event 48: 交互请求创建
3. ✅ Event 53: 交互解决（玩家选择了审判官）
4. ❌ **缺失**：没有 `ONGOING_ABILITY_REMOVED` 事件
5. ❌ **缺失**：没有 `MODIFIER_TOKEN_REMOVED` 事件

**这说明交互处理器（interaction handler）没有正确执行标记移除逻辑。**

## 问题定位

### 可能的原因

1. **交互处理器未注册**
   - `registerCardOpsInteractionHandlers()` 可能没有被调用
   - 或者注册的 handler ID 与能力 ID 不匹配

2. **交互处理器逻辑有 bug**
   - Handler 被调用了，但是没有正确发射移除事件
   - 或者事件发射了，但是 reducer 没有正确处理

3. **CardiaEventSystem 没有正确处理交互响应**
   - `SYS_INTERACTION_RESOLVED` 事件被发射了
   - 但是 `CardiaEventSystem` 没有调用对应的交互处理器

### 需要检查的代码

1. **交互处理器注册**（`src/games/cardia/domain/abilities/group4-card-ops.ts`）：
```typescript
export function registerCardOpsInteractionHandlers(): void {
    // 虚空法师：选择目标卡牌后移除所有标记
    registerInteractionHandler(ABILITY_IDS.VOID_MAGE, (state, _playerId, value, _interactionData, _random, timestamp) => {
        // ... 移除标记的逻辑
    });
}
```

2. **CardiaEventSystem**（`src/games/cardia/domain/systems.ts`）：
```typescript
// 处理交互解决事件
if (event.type === 'SYS_INTERACTION_RESOLVED') {
    // 调用交互处理器
    const handler = interactionHandlers.get(abilityId);
    if (handler) {
        const result = handler(state, playerId, value, interactionData, random, timestamp);
        // 应用结果
    }
}
```

3. **Reducer**（`src/games/cardia/domain/reduce.ts`）：
```typescript
// 处理 ONGOING_ABILITY_REMOVED 事件
case CARDIA_EVENTS.ONGOING_ABILITY_REMOVED:
    // 从 core.ongoingAbilities 中移除
    // 从 card.ongoingMarkers 中移除

// 处理 MODIFIER_TOKEN_REMOVED 事件
case CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED:
    // 从 core.modifierTokens 中移除
```

## 下一步调试建议

### 1. 检查交互处理器是否被调用

在 `src/games/cardia/domain/abilities/group4-card-ops.ts` 的交互处理器中添加日志：

```typescript
registerInteractionHandler(ABILITY_IDS.VOID_MAGE, (state, _playerId, value, _interactionData, _random, timestamp) => {
    console.log('[VoidMage Handler] Called with:', { value, timestamp });
    
    const selectedCard = value as { cardUid?: string };
    const targetCardId = selectedCard.cardUid;
    
    console.log('[VoidMage Handler] Target card:', targetCardId);
    
    // ... 后续逻辑
});
```

### 2. 检查事件是否正确发射

在交互处理器中检查返回的事件：

```typescript
const events = [
    // ONGOING_ABILITY_REMOVED 事件
    // MODIFIER_TOKEN_REMOVED 事件
];

console.log('[VoidMage Handler] Emitting events:', events);
return { events };
```

### 3. 检查 CardiaEventSystem 是否正确处理

在 `src/games/cardia/domain/systems.ts` 中添加日志：

```typescript
if (event.type === 'SYS_INTERACTION_RESOLVED') {
    console.log('[CardiaEventSystem] Interaction resolved:', event.payload);
    
    const handler = interactionHandlers.get(abilityId);
    console.log('[CardiaEventSystem] Handler found:', !!handler);
    
    if (handler) {
        const result = handler(...);
        console.log('[CardiaEventSystem] Handler result:', result);
    }
}
```

## 预期修复后的事件流

修复后，事件流应该包含：

```json
{
  "id": 54,
  "event": {
    "type": "cardia:ongoing_ability_removed",
    "payload": {
      "abilityId": "ability_i_judge",
      "cardId": "p2_played_judge",
      "playerId": "1"
    }
  }
},
{
  "id": 55,
  "event": {
    "type": "cardia:modifier_token_removed",
    "payload": {
      "cardId": "p2_played_judge",
      "value": -3,
      "source": "ability_i_inventor"
    }
  }
}
```

## 总结

✅ **虚空法师能力激活正常**：能力检测、交互创建、玩家选择都正确
❌ **标记移除失败**：交互解决后没有触发标记移除逻辑

**根本原因**：交互处理器（interaction handler）没有被正确调用或执行

**修复方向**：检查交互处理器的注册、调用和事件发射逻辑
