# Card02 虚空法师 - 修复验证成功 ✅

## 手动测试结果

**测试时间**：修复 `abilityId` 字段后
**测试场景**：选择 P2 的审判官（有持续标记 + 修正标记）

## 状态对比

### 修复前（第一次测试）

```json
{
  "ongoingAbilities": [
    {
      "abilityId": "ability_i_judge",
      "cardId": "p2_played_judge",
      "playerId": "1"
    }
  ],
  "modifierTokens": [
    {
      "cardId": "p1_played_surgeon",
      "value": 5,
      "source": "ability_i_inventor"
    },
    {
      "cardId": "p2_played_judge",  // ❌ 审判官的修正标记未移除
      "value": -3,
      "source": "ability_i_inventor"
    }
  ],
  "players": {
    "1": {
      "playedCards": [
        {
          "uid": "p2_played_judge",
          "ongoingMarkers": ["ability_i_judge"]  // ❌ 持续标记未移除
        }
      ]
    }
  }
}
```

### 修复后（第二次测试）✅

```json
{
  "ongoingAbilities": [],  // ✅ 持续能力已移除
  "modifierTokens": [
    {
      "cardId": "p1_played_surgeon",  // ✅ P1 外科医生的修正标记保留
      "value": 5,
      "source": "ability_i_inventor"
    }
    // ✅ P2 审判官的修正标记已移除
  ],
  "players": {
    "1": {
      "playedCards": [
        {
          "uid": "p2_played_judge",
          "ongoingMarkers": []  // ✅ 持续标记已移除
        }
      ]
    }
  }
}
```

## 验证结果

### ✅ 持续能力移除成功

**修复前**：
```json
"ongoingAbilities": [
  {
    "abilityId": "ability_i_judge",
    "cardId": "p2_played_judge",
    "playerId": "1"
  }
]
```

**修复后**：
```json
"ongoingAbilities": []
```

### ✅ 持续标记移除成功

**修复前**：
```json
{
  "uid": "p2_played_judge",
  "ongoingMarkers": ["ability_i_judge"]
}
```

**修复后**：
```json
{
  "uid": "p2_played_judge",
  "ongoingMarkers": []
}
```

### ✅ 修正标记移除成功

**修复前**：
```json
"modifierTokens": [
  { "cardId": "p1_played_surgeon", "value": 5 },
  { "cardId": "p2_played_judge", "value": -3 }  // ← 审判官的修正标记
]
```

**修复后**：
```json
"modifierTokens": [
  { "cardId": "p1_played_surgeon", "value": 5 }  // ← 只剩外科医生的修正标记
]
```

### ✅ 未选中的卡牌标记保留

P1 的外科医生有 +5 修正标记，因为选择的是 P2 的审判官，所以外科医生的修正标记被正确保留。

## 功能验证

| 功能 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 能力激活 | 虚空法师能力正确触发 | ✅ | 通过 |
| 标记检测 | 检测到两张有标记的卡牌 | ✅ | 通过 |
| 弹窗显示 | 显示卡牌选择弹窗 | ✅ | 通过 |
| 玩家选择 | 可以选择目标卡牌 | ✅ | 通过 |
| 持续能力移除 | 从 `core.ongoingAbilities` 移除 | ✅ | 通过 |
| 持续标记移除 | 从 `card.ongoingMarkers` 移除 | ✅ | 通过 |
| 修正标记移除 | 从 `core.modifierTokens` 移除 | ✅ | 通过 |
| 未选中卡牌保留 | 未选中卡牌的标记保留 | ✅ | 通过 |

## 修复总结

### 问题根源

虚空法师创建交互时缺少 `abilityId` 字段，导致 `CardiaEventSystem` 无法找到对应的交互处理器。

### 修复方案

在 `src/games/cardia/domain/abilities/group4-card-ops.ts` 中添加 `abilityId` 字段：

```typescript
const interaction: CardiaInteraction = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    abilityId: ctx.abilityId,  // ← 添加这一行
    title: '选择目标卡牌',
    description: '从任一张牌上弃掉所有修正标记和持续标记',
    availableCards: allCardsWithMarkers,
    minSelect: 1,
    maxSelect: 1,
};
```

### 修复效果

✅ **完全修复**：所有功能正常工作，标记正确移除

## 下一步

### 1. 运行 E2E 测试

```bash
npx playwright test cardia-deck1-card02-void-mage.e2e.ts
```

### 2. 检查其他卡牌

检查其他使用交互的卡牌是否也缺少 `abilityId` 字段：
- Card07 宫廷卫士（派系选择）
- Card09 伏击者
- Card10 傀儡师
- Card13 沼泽守卫（卡牌选择）
- Card14 女导师
- Card15 发明家（修正值选择）

### 3. 更新测试

确保 E2E 测试使用正确的 UID 格式（已在 `e2e/helpers/cardia.ts` 中修复）。

## 相关文档

- 问题分析：`CARD02-MANUAL-TEST-RESULT.md`
- 修复说明：`CARD02-BUG-FIX-COMPLETE.md`
- 调试指南：`CARD02-DEBUG-GUIDE.md`
- 测试 JSON：`CARD02-INJECT-STATE.json`

## 结论

🎉 **虚空法师能力修复成功！** 所有标记（持续能力、持续标记、修正标记）都被正确移除。
