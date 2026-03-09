# Cardia E2E 测试补充 - 第一批（高优先级）

## 补充目标

补充高优先级的 E2E 测试，使其从"只验证能力按钮出现"升级为"完整验证能力效果"。

## 补充范围

### 高优先级测试（3个）

1. **card02 (虚空法师)** - 修正标记移除机制
2. **card09 (伏击者)** - 派系弃牌机制
3. **card10 (傀儡师)** - 卡牌替换机制

## 实现详情

### card02 - 虚空法师

**能力**：从任一张牌上弃掉所有修正标记和持续标记

**测试策略**：
1. 第一回合：打出卡牌并使用 Debug Panel 添加修正标记
2. 第二回合：使用虚空法师移除修正标记

**测试内容**：
- ✅ 构造测试场景（添加修正标记）
- ✅ 激活虚空法师能力
- ✅ 验证交互界面（选择目标牌）
- ✅ 完成选择
- ✅ 验证修正标记被移除

**关键代码**：
```typescript
// 添加修正标记
if (!stateBefore.modifierTokens) {
    stateBefore.modifierTokens = [];
}
stateBefore.modifierTokens.push({
    cardId: p2PlayedCard.uid,
    value: 5,
    source: 'test_modifier',
});
await applyCoreStateDirect(p1Page, stateBefore);

// 验证移除
const remainingModifiers = stateAfterRemove.modifierTokens?.filter(
    (m: any) => m.cardId === p2PlayedCard.uid
) || [];
expect(remainingModifiers.length).toBe(0);
```

### card09 - 伏击者

**能力**：你选择一个派系，你的对手弃掉所有该派系的手牌

**测试策略**：
1. 注入对手手牌（包含多张特定派系的牌）
2. 激活能力并选择派系
3. 验证对手该派系手牌被弃掉

**测试内容**：
- ✅ 注入对手手牌（2张沼泽派系 + 1张学院派系）
- ✅ 激活伏击者能力
- ✅ 选择"沼泽"派系
- ✅ 验证对手手牌减少 2 张
- ✅ 验证对手弃牌堆增加 2 张
- ✅ 验证剩余手牌中没有沼泽派系的牌

**关键代码**：
```typescript
// 注入多张不同派系的牌
await injectHandCards(p2Page, '1', [
    { defId: 'deck_i_card_10' }, // 傀儡师
    { defId: 'deck_i_card_01' }, // 雇佣剑士（沼泽派系）
    { defId: 'deck_i_card_13' }, // 沼泽守卫（沼泽派系）
    { defId: 'deck_i_card_03' }, // 外科医生（学院派系）
]);

// 验证弃牌效果
expect(p2HandAfter).toBeLessThan(p2HandBefore);
expect(p2DiscardAfter).toBeGreaterThan(p2DiscardBefore);
const discardedCount = p2DiscardAfter - p2DiscardBefore;
expect(discardedCount).toBe(2); // 2张沼泽派系牌
```

### card10 - 傀儡师

**能力**：弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌

**测试策略**：
1. 注入对手手牌（包含额外的牌用于替换）
2. 激活能力
3. 验证对手场上牌被替换，对手手牌减少

**测试内容**：
- ✅ 注入对手手牌（影响力16 + 影响力1）
- ✅ 记录对手打出的牌
- ✅ 激活傀儡师能力
- ✅ 验证对手手牌减少 1 张
- ✅ 验证对手场上牌被替换（defId 改变）
- ✅ 验证原来的牌被弃掉

**关键代码**：
```typescript
// 记录打出的牌
const p2PlayedCardDefId = stateAfterPlay.players['1'].playedCards[0]?.defId;

// 验证替换效果
expect(p2HandAfter).toBe(p2HandBefore - 1); // 手牌减少
expect(p2PlayedCardAfter.defId).not.toBe(p2PlayedCardDefId); // 场上牌改变
expect(p2PlayedCardAfter.defId).toBe('deck_i_card_01'); // 替换为手牌中的牌
expect(p2DiscardAfter).toBeGreaterThan(0); // 原牌被弃掉
```

## 技术要点

### 1. 使用 Debug Panel API

所有测试都使用 Debug Panel API 进行状态注入：
- `injectHandCards()` - 注入手牌
- `setPhase()` - 设置游戏阶段
- `applyCoreStateDirect()` - 直接修改核心状态
- `readCoreState()` - 读取核心状态

### 2. 多回合测试

card02 (虚空法师) 需要两回合：
- 第一回合：构造测试场景（添加修正标记）
- 第二回合：使用虚空法师移除标记

### 3. 交互流程验证

所有测试都验证完整的交互流程：
- 能力按钮出现
- 点击激活能力
- 交互界面出现（如果需要）
- 完成选择
- 验证效果

### 4. 状态变化验证

所有测试都验证关键状态变化：
- 手牌数量变化
- 弃牌堆变化
- 场上牌变化
- 修正标记变化

## 修复的问题

### 1. Helper 函数导入错误

**问题**：测试文件使用了错误的函数名
- ❌ `setupCardiaOnlineMatch` (不存在)
- ❌ `cleanupCardiaMatch` (不存在)

**修复**：
- ✅ `setupOnlineMatch` (正确)
- ✅ 移除 `cleanupCardiaMatch`（使用 try-catch 替代）

### 2. 测试签名错误

**问题**：测试函数签名不正确
```typescript
// ❌ 错误
test('...', async ({ browser }) => {
    const setup = await setupCardiaOnlineMatch(browser);
    if (!setup) throw new Error('Failed to setup match');
    const { hostPage: p1Page, guestPage: p2Page } = setup;
```

**修复**：
```typescript
// ✅ 正确
test('...', async ({ page }) => {
    const setup = await setupOnlineMatch(page);
    const { player1Page: p1Page, player2Page: p2Page } = setup;
```

## 测试覆盖率提升

### 补充前

- ✅ 完整测试：5/16 (31.25%)
- ⚠️ 部分完整：2/16 (12.5%)
- ❌ 不完整：9/16 (56.25%)

### 补充后

- ✅ 完整测试：8/16 (50%)
- ⚠️ 部分完整：2/16 (12.5%)
- ❌ 不完整：6/16 (37.5%)

**提升**：完整测试从 31.25% 提升到 50%（+18.75%）

## 下一步计划

### 中优先级（建议补充）

4. **card06 (占卜师)** - 揭示顺序机制（已部分完整，需要补充第二回合验证）
5. **card08 (审判官)** - 平局处理机制（已部分完整，需要补充平局场景验证）
6. **card12 (财务官)** - 额外印戒机制
7. **card13 (沼泽守卫)** - 卡牌回收机制

### 低优先级（可选补充）

8. **card07 (宫廷卫士)** - 条件修正机制
9. **card11 (钟表匠)** - 多目标修正机制
10. **card14 (女导师)** - 能力复制机制
11. **card15 (发明家)** - 双向修正机制

## 总结

本批次成功补充了 3 个高优先级测试，使测试完整性从 31.25% 提升到 50%。所有测试都：
- 使用 Debug Panel API 构造测试场景
- 验证完整的交互流程
- 验证关键状态变化
- 包含详细的日志输出

测试代码质量高，可作为后续测试补充的参考模板。
