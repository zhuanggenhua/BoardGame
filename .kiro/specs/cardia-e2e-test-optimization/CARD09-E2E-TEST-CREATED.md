# Card09 伏击者 - E2E 测试已创建

## 测试文件

`e2e/cardia-deck1-card09-ambusher.e2e.ts`

## 测试状态

✅ **测试文件已创建并可以运行**
❌ **测试失败：能力按钮不可见**

## 测试结果

```
=== 阶段1：注入测试状态 ===
注入后的状态: {
  phase: 'ability',
  currentPlayerId: '0',
  p1Hand: 1,
  p2Hand: 4,
  p2HandCards: [
    { defId: 'deck_i_card_08', faction: 'academy' },
    { defId: 'deck_i_card_14', faction: 'academy' },
    { defId: 'deck_i_card_01', faction: 'guild' },
    { defId: 'deck_i_card_07', faction: 'dynasty' }
  ]
}

=== 阶段2：激活能力 ===
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="cardia-activate-ability-btn"]') to be visible
```

## 问题分析

### 状态注入成功

✅ 状态注入成功：
- `phase: 'ability'` ✓
- `currentPlayerId: '0'` ✓
- P1 手牌：1 张（伏击者）✓
- P2 手牌：4 张（2 张 Academy + 1 张 Guild + 1 张 Dynasty）✓

### 能力按钮不可见

❌ 能力按钮不可见：
- `[data-testid="cardia-activate-ability-btn"]` 在 5 秒内未出现
- 这与手动测试中的问题一致

## 根本原因（推测）

从手动测试和 E2E 测试的一致性来看，问题不是"代码没有被重新加载"，而是**能力按钮的显示逻辑有问题**。

### 可能的原因

1. **能力按钮显示条件不满足**
   - 可能需要检查 `Board.tsx` 中能力按钮的显示条件
   - 可能需要检查 `playedCards` 中的卡牌是否正确设置了 `encounterIndex`

2. **状态注入不完整**
   - 可能缺少某些必要的字段（如 `previousEncounter`、`encounterHistory` 等）
   - 可能需要更完整的状态结构

3. **UI 组件逻辑问题**
   - 能力按钮可能依赖于某些未注入的状态
   - 可能需要检查 `useAbilityActivation` 或类似的 Hook

## 下一步行动

### 方案 A：检查能力按钮显示逻辑（推荐）

1. 打开 `src/games/cardia/Board.tsx`
2. 搜索 `cardia-activate-ability-btn`
3. 检查能力按钮的显示条件
4. 确认需要哪些状态字段

### 方案 B：使用更完整的状态注入

1. 从手动测试中复制完整的游戏状态（包括 `previousEncounter`、`encounterHistory` 等）
2. 注入到 E2E 测试中
3. 验证能力按钮是否出现

### 方案 C：跳过 Card09，继续修复其他卡牌

Card09 的问题可能比较复杂，可以先跳过，继续修复其他卡牌的 E2E 测试。

## 单元测试状态

✅ **单元测试正常**

`src/games/cardia/__tests__/ability-ambusher.test.ts` 中的单元测试正常工作：
- ✅ 第一次调用：应该创建派系选择交互
- ✅ 当对手手牌为空时，应该只产生派系选择交互

单元测试只测试能力执行器（第一次调用），不测试交互处理器（第二次调用）。

## 总结

1. ✅ E2E 测试文件已创建并可以运行
2. ✅ 状态注入成功
3. ❌ 能力按钮不可见（与手动测试一致）
4. ✅ 单元测试正常

**建议**：优先检查能力按钮的显示逻辑（方案 A），如果问题复杂，可以先跳过 Card09，继续修复其他卡牌。

## 相关文档

- `CARD09-CURRENT-STATUS.md` - 当前状态总结
- `CARD09-DEBUG-GUIDE.md` - 手动调试指南
- `CARD09-FIX-COMPLETE.md` - 修复说明
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - E2E 测试文件
- `src/games/cardia/__tests__/ability-ambusher.test.ts` - 单元测试文件
