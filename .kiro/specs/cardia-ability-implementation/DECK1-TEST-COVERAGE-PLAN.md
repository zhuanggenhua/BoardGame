# DECK1 测试覆盖补充计划

> **创建日期**：2026-03-01  
> **任务范围**：补充沼泽守卫、女导师、伏击者的单元测试  
> **状态**：📝 规划中

---

## 测试覆盖现状

### 已有测试文件

1. **`src/games/cardia/__tests__/abilities-group4-card-ops.test.ts`**
   - 包含沼泽守卫（Swamp Guard）和虚空法师（Void Mage）的测试
   - ⚠️ 需要更新以匹配当前的交互实现

2. **`src/games/cardia/__tests__/abilities-group5-copy.test.ts`**
   - 包含女导师（Governess）、幻术师（Illusionist）、元素师（Elementalist）的测试
   - ⚠️ 需要更新以匹配当前的交互实现

3. **`src/games/cardia/__tests__/ability-ambusher.test.ts`**
   - 包含伏击者（Ambusher）的测试
   - ⚠️ 需要更新以匹配当前的交互实现

---

## 测试更新需求

### 1. 沼泽守卫（Swamp Guard）测试更新

**文件**：`src/games/cardia/__tests__/abilities-group4-card-ops.test.ts`

**需要更新的测试**：

#### 1.1 第一次调用：创建交互
```typescript
it('第一次调用：应该创建交互让玩家选择目标卡牌', () => {
  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(mockContext);

  // 第一次调用应该返回交互
  expect(executor.interaction).toBeDefined();
  expect(executor.interaction.type).toBe('card_selection');
  expect(executor.interaction.availableCards).toBeDefined();
  expect(executor.interaction.availableCards.length).toBe(1); // 只有 played1 可选
  expect(executor.interaction.availableCards).toContain('played1');
  expect(executor.events).toHaveLength(0); // 第一次调用不产生事件
});
```

#### 1.2 第二次调用：执行回收逻辑
```typescript
it('第二次调用：选择卡牌后应该回收己方卡牌到手牌，并弃掉相对的牌', () => {
  const contextWithSelection = {
    ...mockContext,
    selectedCardId: 'played1',
  };
  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

  expect(executor.events.length).toBe(2);
  
  // 第一个事件：回收己方卡牌
  const recycleEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARD_RECYCLED);
  expect(recycleEvent).toBeDefined();
  expect((recycleEvent?.payload as any).playerId).toBe('player1');
  expect((recycleEvent?.payload as any).cardId).toBe('played1');
  expect((recycleEvent?.payload as any).from).toBe('field');
  
  // 第二个事件：弃掉对手相对的牌
  const discardEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED);
  expect(discardEvent).toBeDefined();
  expect((discardEvent?.payload as any).playerId).toBe('player2');
  expect((discardEvent?.payload as any).cardIds).toContain('opp_played1');
  expect((discardEvent?.payload as any).from).toBe('field');
});
```


#### 1.3 边界条件：没有场上卡牌
```typescript
it('当己方没有其他场上卡牌时，应该发射 ABILITY_NO_VALID_TARGET 事件', () => {
  mockCore.players['player1'].playedCards = [mockCore.players['player1'].playedCards[1]];

  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(mockContext);

  expect(executor.events).toHaveLength(1);
  expect(executor.events[0].type).toBe(CARDIA_EVENTS.ABILITY_NO_VALID_TARGET);
  expect((executor.events[0].payload as any).reason).toBe('no_field_cards');
  expect(executor.interaction).toBeUndefined();
});
```

#### 1.4 边界条件：没有相对的牌
```typescript
it('当对手没有相对的牌时，应该只回收己方卡牌', () => {
  mockCore.players['player2'].playedCards = [];

  const contextWithSelection = {
    ...mockContext,
    selectedCardId: 'played1',
  };
  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

  expect(executor.events).toHaveLength(1);
  expect(executor.events[0].type).toBe(CARDIA_EVENTS.CARD_RECYCLED);
});
```

---

### 2. 女导师（Governess）测试更新

**文件**：`src/games/cardia/__tests__/abilities-group5-copy.test.ts`

**需要更新的测试**：

#### 2.1 第一次调用：创建交互
```typescript
it('第一次调用：应该创建交互让玩家选择目标卡牌', () => {
  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!(mockContext);

  // 第一次调用应该返回交互
  expect(executor.interaction).toBeDefined();
  expect(executor.interaction.type).toBe('card_selection');
  expect(executor.interaction.availableCards).toBeDefined();
  expect(executor.interaction.availableCards.length).toBeGreaterThan(0);
  expect(executor.events).toHaveLength(0); // 第一次调用不产生事件
});
```

#### 2.2 第二次调用：递归执行被复制的能力
```typescript
it('第二次调用：选择卡牌后应该递归执行被复制的能力', () => {
  const contextWithSelection = {
    ...mockContext,
    selectedCardId: 'played1',
  };
  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!(contextWithSelection);

  // 第一个事件：ABILITY_COPIED
  expect(executor.events[0].type).toBe(CARDIA_EVENTS.ABILITY_COPIED);
  expect((executor.events[0].payload as any).sourceCardId).toBe('played1');
  expect((executor.events[0].payload as any).sourceAbilityId).toBe(ABILITY_IDS.SABOTEUR);
  expect((executor.events[0].payload as any).copiedByCardId).toBe('played2');
  expect((executor.events[0].payload as any).copiedByPlayerId).toBe('player1');
  
  // 后续事件：被复制能力的事件（破坏者的事件）
  // 破坏者会产生 CARDS_DISCARDED_FROM_DECK 事件
  expect(executor.events.length).toBeGreaterThan(1);
});
```

#### 2.3 边界条件：没有符合条件的卡牌
```typescript
it('当己方没有影响力≥14的场上卡牌时，应该发射 ABILITY_NO_VALID_TARGET 事件', () => {
  mockCore.players['player1'].playedCards[0].baseInfluence = 10;

  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!(mockContext);

  expect(executor.events).toHaveLength(1);
  expect(executor.events[0].type).toBe(CARDIA_EVENTS.ABILITY_NO_VALID_TARGET);
  expect((executor.events[0].payload as any).reason).toBe('no_eligible_cards');
});
```

---

### 3. 伏击者（Ambusher）测试更新

**文件**：`src/games/cardia/__tests__/ability-ambusher.test.ts`

**需要更新的测试**：

#### 3.1 第一次调用：创建派系选择交互
```typescript
it('第一次调用：应该创建派系选择交互', () => {
  const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

  // 第一次调用应该返回交互
  expect(executor.interaction).toBeDefined();
  expect(executor.interaction.type).toBe('faction_selection');
  expect(executor.events).toHaveLength(0); // 第一次调用不产生事件
});
```

#### 3.2 交互处理器：弃掉对手该派系的手牌
```typescript
it('交互处理器：选择派系后应该弃掉对手该派系的手牌', () => {
  // 这个测试需要通过交互处理器测试
  // 或者通过 E2E 测试验证
});
```

---

## 测试执行计划

### 阶段 1：更新现有测试文件（优先级：高）

1. **更新 `abilities-group4-card-ops.test.ts`**
   - 修复沼泽守卫测试，匹配当前的交互实现
   - 修复虚空法师测试，匹配当前的交互实现
   - 添加边界条件测试

2. **更新 `abilities-group5-copy.test.ts`**
   - 修复女导师测试，匹配当前的交互实现
   - 验证递归执行逻辑
   - 添加边界条件测试

3. **更新 `ability-ambusher.test.ts`**
   - 修复伏击者测试，匹配当前的交互实现
   - 添加交互流程测试

### 阶段 2：运行测试验证（优先级：高）

```bash
# 运行所有 Cardia 测试
npm run test -- src/games/cardia/__tests__/

# 运行特定测试文件
npm run test -- src/games/cardia/__tests__/abilities-group4-card-ops.test.ts
npm run test -- src/games/cardia/__tests__/abilities-group5-copy.test.ts
npm run test -- src/games/cardia/__tests__/ability-ambusher.test.ts
```

### 阶段 3：补充 E2E 测试（优先级：中）

1. **沼泽守卫 E2E 测试**
   - 测试完整的交互流程（选择卡牌 → 回收 → 弃掉相对的牌）
   - 测试边界情况（没有场上卡牌、没有相对的牌）

2. **女导师 E2E 测试**
   - 测试完整的交互流程（选择卡牌 → 复制能力 → 执行被复制的能力）
   - 测试递归执行逻辑
   - 测试边界情况（没有符合条件的卡牌）

3. **伏击者 E2E 测试**
   - 测试完整的交互流程（选择派系 → 弃掉对手手牌）
   - 测试边界情况（对手没有该派系手牌）

---

## 测试覆盖目标

### 单元测试覆盖率

- **沼泽守卫**：✅ 100%（所有分支和边界条件）
- **女导师**：✅ 100%（所有分支和边界条件）
- **伏击者**：✅ 100%（所有分支和边界条件）

### E2E 测试覆盖率

- **沼泽守卫**：✅ 核心流程 + 边界情况
- **女导师**：✅ 核心流程 + 递归执行 + 边界情况
- **伏击者**：✅ 核心流程 + 边界情况

---

## 下一步行动

1. ✅ **创建测试覆盖计划**（当前文档）
2. 📝 **更新单元测试文件**
   - 修复 `abilities-group4-card-ops.test.ts`
   - 修复 `abilities-group5-copy.test.ts`
   - 修复 `ability-ambusher.test.ts`
3. 📝 **运行测试验证**
   - 确认所有测试通过
   - 修复失败的测试
4. 📝 **补充 E2E 测试**
   - 创建 `e2e/cardia-deck1-swamp-guard.e2e.ts`
   - 创建 `e2e/cardia-deck1-governess.e2e.ts`
   - 创建 `e2e/cardia-deck1-ambusher.e2e.ts`

---

**创建日期**：2026-03-01  
**创建人**：Kiro AI Assistant  
**审计报告**：`.kiro/specs/cardia-ability-implementation/DECK1-FULL-AUDIT-REPORT.md`  
**交互验证报告**：`.kiro/specs/cardia-ability-implementation/DECK1-INTERACTION-VERIFICATION-COMPLETE.md`
