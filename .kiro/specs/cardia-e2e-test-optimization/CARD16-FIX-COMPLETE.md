# Card16 (精灵) 测试修复完成

## 问题

card16 (精灵) 的测试写错了，没有理解精灵能力的正确触发机制。

## 根本原因

**错误理解**：
- 测试假设精灵能力是"你赢得游戏"（无条件触发）
- 测试场景：P1 打出精灵（影响力16），P2 打出发明家（影响力15），P1 获胜

**正确理解**：
- 精灵能力的 `trigger` 是 `'onLose'`（失败时触发）
- 能力效果：你赢得游戏（失败时直接获胜）
- 正确场景：P1 打出精灵（影响力16），P2 打出更高影响力的牌（使用修正标记让影响力 > 16），P1 失败，触发精灵能力，P1 激活能力后直接获胜

## 修复内容

### 1. 修改测试场景

**旧场景**：
```typescript
player1: {
    hand: ['deck_i_card_16'], // 精灵（影响力16）
},
player2: {
    hand: ['deck_i_card_15'], // 发明家（影响力15）
},
```

**新场景**：
```typescript
player1: {
    hand: ['deck_i_card_16'], // 精灵（影响力16）
},
player2: {
    hand: ['deck_i_card_01'], // 雇佣剑士（影响力1）
},
// 给 P2 的手牌添加修正标记，使其影响力 > 16
modifierTokens: [
    {
        cardId: 'test_1_0', // P2 的第一张手牌
        value: 20,
        source: 'test_modifier',
    }
],
```

### 2. 更新测试注释

```typescript
/**
 * 影响力16 - 精灵（使用新API重写）
 * 能力：你赢得游戏（trigger: onLose - 失败时触发）
 * 
 * 测试场景：
 * - P1 打出精灵（影响力16）
 * - P2 打出更高影响力的牌（使用修正标记让影响力 > 16）
 * - P1 失败，触发精灵能力
 * - P1 激活精灵能力，直接获胜
 */
```

### 3. 添加遭遇战结果验证

```typescript
// 验证遭遇战结果：P2 应该赢（21 > 16），P1 失败
const stateAfterEncounter = await readLiveState(setup.player1Page);
console.log('遭遇战解析后状态:', {
    phase: stateAfterEncounter.core.phase,
    p1PlayedCard: stateAfterEncounter.core.players['0'].playedCards[0]?.baseInfluence,
    p2PlayedCard: stateAfterEncounter.core.players['1'].playedCards[0]?.baseInfluence,
    modifierTokens: stateAfterEncounter.core.modifierTokens,
});

// P1 失败，精灵能力应该可以激活（trigger: 'onLose'）
console.log('等待 P1 的能力按钮（精灵能力 - onLose 触发）');
```

### 4. 修复 cleanup 方法

**错误**：
```typescript
await setup.cleanup(); // cleanup 方法不存在
```

**正确**：
```typescript
await setup.player1Context.close();
await setup.player2Context.close();
```

### 5. 修复 gameover 字段检查

**错误**：
```typescript
expect(sys.gameover!.reason).toBe('elf'); // reason 字段不存在
```

**正确**：
```typescript
expect(sys.gameover).toBeDefined();
expect(sys.gameover!.winner).toBe('0');
// 注意：reason 字段可能不存在，不强制检查
```

## 测试结果

✅ 测试通过

```
=== 阶段1：打出卡牌 ===
P1 打出影响力16（精灵）
P2 打出影响力1（带修正标记，实际影响力 21）

=== 阶段2：激活能力 ===
遭遇战解析后状态: {
  phase: 'ability',
  p1PlayedCard: 16,
  p2PlayedCard: 1,
  modifierTokens: [ { cardId: 'test_1_0', value: 20, source: 'test_modifier' } ]
}
等待 P1 的能力按钮（精灵能力 - onLose 触发）
✅ 能力按钮已显示
激活精灵能力

=== 验证游戏结束 ===
能力执行后（完整状态）: { isGameOver: true, winner: '0', fullGameover: { winner: '0' } }
✅ P1 通过精灵能力直接获胜
✅ 所有断言通过
```

## 关键教训

1. **必须理解能力的触发机制**：不能只看能力描述，必须查看 `abilityRegistry.ts` 中的 `trigger` 字段
2. **onLose vs onWin**：
   - `onLose`：失败时触发（大部分能力）
   - `onWin`：胜利时触发（少数能力，如贵族）
   - `ongoing`：持续效果（需要持续标记）
3. **参考旧版本测试**：修改测试前，必须先查看旧版本的测试逻辑，理解正确的测试场景
4. **修正标记的使用**：可以通过 `modifierTokens` 配置创建特定的测试场景（如让低影响力的牌变成高影响力）

## 影响

- ✅ card16 测试从失败变为通过
- ✅ 通过率从 60% 提升到 70%（7/10）
- ✅ 证明了新 API 可以正确处理复杂的测试场景（修正标记 + 失败触发）

## 相关文件

- `e2e/cardia-deck1-card16-elf.e2e.ts` - 修复后的测试
- `src/games/cardia/domain/abilityRegistry.ts` - 能力注册表（包含 trigger 定义）
- `src/games/cardia/domain/abilities/group6-special.ts` - 精灵能力实现
